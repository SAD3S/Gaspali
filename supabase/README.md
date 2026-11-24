# Supabase — mise en place

L'app fonctionne sans serveur (mode local). Pour activer comptes, foyers et synchronisation :

## 1. Créer le projet

1. Sur [supabase.com](https://supabase.com), crée un projet (région **eu-west**, Paris ou Francfort, pour le RGPD).
2. *Project Settings › API* : note l'**URL** et la clé **anon public**.

## 2. Appliquer le schéma

Au choix :
- **SQL Editor** : colle et exécute, dans l'ordre, les fichiers de `migrations/`
  (`20261124120000_foyers_et_inventaire.sql`, puis `20261124160000_recettes_preferences_courses.sql`) ;
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

## Fonctionnement de la synchronisation

- Les identifiants sont des UUID générés sur le téléphone : on peut tout créer hors ligne.
- Chaque modification locale est mise en file (`outbox`) avec l'horodatage de **chaque champ**.
- À l'envoi, `sync_push` applique un champ seulement s'il est plus récent que celui du serveur
  (**dernière modification gagne, champ par champ** : si Léa change la quantité et Tom l'emplacement
  du même produit hors ligne, les deux modifications sont gardées).
- La récupération est incrémentale (curseur `server_seq`) ; Realtime prévient les autres téléphones.
- Les suppressions sont douces (`deleted_at`) pour se propager comme les autres modifications.
- Limite connue : l'arbitrage repose sur l'horloge des téléphones (réglée automatiquement en pratique).
