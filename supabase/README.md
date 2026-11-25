# Supabase — mise en place

L'app fonctionne sans serveur (mode local). Pour activer comptes, foyers et synchronisation :

## 1. Créer le projet

1. Sur [supabase.com](https://supabase.com), crée un projet (région **eu-west**, Paris ou Francfort, pour le RGPD).
2. *Project Settings › API* : note l'**URL** et la clé **anon public**.

## 2. Appliquer le schéma

Au choix :
- **Le plus simple** : *SQL Editor › New query*, colle tout le contenu de `setup.sql` (toutes les migrations,
  dans l'ordre), puis **Run**. À faire une seule fois, sur un projet neuf ;
- **SQL Editor, fichier par fichier** : les fichiers de `migrations/`, dans l'ordre ;
- **CLI** : `supabase link --project-ref <ref>` puis `supabase db push`.

Le schéma crée : profils, foyers, membres (rôles admin / membre), inventaire, produits, historique,
la RLS (chacun ne voit que ses foyers), les fonctions `create_household`, `join_household`,
`regenerate_invite_code`, `leave_household`, `remove_member`, `sync_push`, et la publication Realtime.

Tests : `supabase/tests/run.sh` (Postgres nu, rejoué en CI par `supabase-tests.yml`).

## 3. Authentification

*Authentication › Sign In / Providers*

- **Email** : activé. Dans *Authentication › Emails › Magic Link*, remplace le contenu par un modèle
  qui affiche le **code** (l'app demande un code à 6 chiffres, pas un lien) :
  ```html
  <h2>Ton code Gaspalli</h2>
  <p>Saisis ce code dans l'app : <strong style="font-size:24px">{{ .Token }}</strong></p>
  <p>Il expire dans une heure.</p>
  ```
- **Google** : crée un client OAuth « Web application » dans Google Cloud Console, avec l'URI de redirection
  `https://<ref>.supabase.co/auth/v1/callback`, puis colle l'ID et le secret dans Supabase.
- **Apple** (iOS) : nécessite le compte Apple Developer — à faire à l'étape publication.

*Authentication › URL Configuration › Redirect URLs* : ajoute `gaspalli://auth/callback`.

## 4. Brancher l'app

- **En local** : copie `.env.example` en `.env.local` et renseigne l'URL et la clé anon.
- **Builds GitHub Actions** : *Settings › Secrets and variables › Actions › Variables* (pas *Secrets* :
  la clé anon est publique, la sécurité repose sur la RLS) :
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

## 5. Idées de recettes par IA (Edge Function `generate-recipe`)

La fonction appelle l'API Claude ; **la clé ne quitte jamais le serveur**.

```bash
supabase functions deploy generate-recipe
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…        # clé de console.anthropic.com
# Facultatif :
supabase secrets set AI_DAILY_LIMIT=5                   # idées par foyer et par jour (défaut 5)
supabase secrets set AI_EFFORT=medium                   # low | medium | high (défaut medium)
supabase secrets set AI_MODEL=claude-opus-5-5           # modèle (défaut claude-opus-5-5)
```

Fonctionnement :
- réservée aux membres d'un foyer connectés ; quota par foyer et par jour (heure de Paris),
  réservé sous verrou ; un échec ne consomme pas de quota ;
- même demande dans les 3 jours → réponse en cache, gratuite ;
- réponse contrainte par un schéma JSON (structured outputs), revalidée avec Zod ;
- **allergies = filtre strict** : préférences de l'app ∪ préférences enregistrées sur le serveur,
  revérifiées après génération (ingrédients, libellés libres, étapes, allergènes déclarés) ;
  recette refusée → nouvelle tentative (3 au plus) avec la liste des problèmes ;
- refus de sécurité du modèle : repli automatique côté API (`fallbacks: "default"`).

Coût indicatif avec Claude Opus 5.5 (4 $ / 20 $ par million de tokens en entrée / sortie, effort `medium`) :
de l'ordre de **5 à 10 centimes par recette** (environ 3 000 tokens en entrée, 2 000 à 4 000 en sortie
réflexion comprise ; jusqu'à 3 fois plus si la recette doit être régénérée), soit de l'ordre de 0,50 €
par foyer et par jour au maximum avec le quota de 5. Estimation à confirmer sur les premiers usages :
les tokens réellement consommés sont enregistrés dans `ai_generations`. Pour réduire le coût :
baisser `AI_EFFORT` à `low`, ou choisir un modèle moins cher avec `AI_MODEL`.

Tests : `npx tsc -p supabase/functions` (types contre les SDK épinglés dans `deno.json`) et
`npx jest __tests__/aiRecipe.test.ts` (schéma, validation, allergènes, prompt).

## 6. Suppression de compte (Edge Function `delete-account`)

Exigée par Apple et par le RGPD (droit à l'effacement), depuis Plus › Confidentialité › « Supprimer mon compte ».

Sans outil à installer : *Edge Functions › Deploy a new function › Via Editor*, nom `delete-account`, colle
le contenu de `functions/delete-account/index.ts`, puis **Deploy**. Ou avec la CLI :

```bash
supabase functions deploy delete-account
```

Aucun secret à ajouter : la fonction utilise `SUPABASE_SERVICE_ROLE_KEY`, fournie automatiquement aux fonctions.
Elle appelle `delete_account_data` (réservée à la clé service role) puis supprime l'utilisateur de Supabase Auth :
foyers dont il est le seul membre supprimés avec leurs données ; dans un foyer partagé, l'administration passe
au membre le plus ancien et ce qu'il avait ajouté reste, sans auteur ; profil et préférences alimentaires effacés.

## 7. E-mails de connexion (avant d'inviter d'autres personnes)

L'envoi d'e-mails intégré à Supabase est limité à quelques messages par heure : suffisant pour tester à deux,
pas pour une publication. *Authentication › Emails › SMTP Settings* : branche un service d'envoi (Brevo, Resend…
offrent une formule gratuite de quelques milliers d'e-mails par mois) avec une adresse d'expédition à ton nom de domaine.

## Fonctionnement de la synchronisation

- Les identifiants sont des UUID générés sur le téléphone : on peut tout créer hors ligne.
- Chaque modification locale est mise en file (`outbox`) avec l'horodatage de **chaque champ**.
- À l'envoi, `sync_push` applique un champ seulement s'il est plus récent que celui du serveur
  (**dernière modification gagne, champ par champ** : si Léa change la quantité et Tom l'emplacement
  du même produit hors ligne, les deux modifications sont gardées).
- La récupération est incrémentale (curseur `server_seq`) ; Realtime prévient les autres téléphones.
- Les suppressions sont douces (`deleted_at`) pour se propager comme les autres modifications.
- Limite connue : l'arbitrage repose sur l'horloge des téléphones (réglée automatiquement en pratique).
