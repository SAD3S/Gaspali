# Gaspalli

*Moins de gaspi, plus de goût.* — Application mobile anti-gaspillage (React Native + Expo).

- Cahier des charges : [`design/cahier-des-charges.md`](design/cahier-des-charges.md)
- Maquette de référence : `design/Gaspalli – Proposition visuelle.html`

## Démarrer

```bash
npm install
npm start          # Expo (dev build requis à partir de l'étape 3 : caméra / ML Kit)
npm run web        # aperçu navigateur
npm test           # tests Jest (logique métier)
npm run typecheck
```

## Données de démo

En développement, « Paramètres › Charger des produits de démo » remplit l'inventaire, ajoute 5 mois d'historique
(pour l'écran Statistiques) et met en cache le code-barres `3260000000012` (à saisir via « Saisir le code »
sur l'écran de scan).

## Tester sur téléphone

- **Expo Go** : `npm start` puis scanner le QR code. Tout fonctionne sauf la lecture de la date et du ticket
  de caisse (OCR ML Kit, module natif), qui demandent l'app compilée ; le ticket peut alors être saisi en texte.
- **APK Android (GitHub Actions)** : `.github/workflows/android-release.yml` vérifie (types + tests), compile l'APK
  et le publie dans une Release GitHub. Deux façons de publier une version :
  - *Actions › Android – build & release › Run workflow* : choisir la branche, taper la version (ex. `0.4.0`) ;
    le tag `v0.4.0` est créé sur le dernier commit de la branche ;
  - ou créer la release dans *Releases › Draft a new release* avec un nouveau tag `vX.Y.Z`.
  Signature : sans secrets, la clé de debug standard est utilisée (OK pour tester). Pour une vraie clé :
  ```bash
  keytool -genkeypair -v -keystore gaspalli-upload.keystore -alias gaspalli -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 gaspalli-upload.keystore   # → secret ANDROID_KEYSTORE_BASE64
  ```
  puis les secrets `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`gaspalli`) et `ANDROID_KEY_PASSWORD`
  (Settings › Secrets and variables › Actions). ⚠️ Changer de clé impose de désinstaller l'app une fois.
- **EAS (optionnel)** : profils `development` / `preview` / `production` dans `eas.json`.
  Les dossiers natifs `android/` et `ios/` sont générés (`npx expo prebuild`) et ne sont pas versionnés.

## Publication

Tout le code est prêt ; il reste des comptes et des réglages que seul le propriétaire du dépôt peut faire.
Dans l'ordre d'utilité :

1. **Partager le frigo entre téléphones** — fait : projet Supabase créé et configuré (`supabase/README.md`), URL et
   clé publique intégrées par la CI (`.github/workflows/android-release.yml`, remplaçables par les variables
   `SUPABASE_URL` et `SUPABASE_ANON_KEY`). Comptes, foyers, synchronisation et suppression de compte sont actifs
   dans les releases.
2. **Idées de recettes par IA** (facultatif) — clé Anthropic dans les secrets Supabase (`supabase/README.md`, étape 5).
3. **Rapports de plantage** (facultatif) — projet React Native sur sentry.io ; variable `SENTRY_DSN`. Pour des piles
   d'appels lisibles : variables `SENTRY_ORG`, `SENTRY_PROJECT` et secret `SENTRY_AUTH_TOKEN`.
4. **Pages web exigées par les stores** — *Settings › Pages* : publier le dossier `docs/` de la branche de travail
   (GitHub Pages ; dépôt public, ou formule payante pour un dépôt privé). Pages obtenues : `…/confidentialite`
   (politique) et `…/suppression-compte`. Variables à ajouter : `PRIVACY_URL` (lien affiché dans l'app) et
   `CONTACT_EMAIL`. Dans la page web, l'adresse de contact est un texte à remplacer : changer `PLACEHOLDER` dans
   `__tests__/privacy.test.ts`, puis `UPDATE_PRIVACY=1 npx jest __tests__/privacy.test.ts`.
5. **Play Store** — compte développeur Google Play (25 $ une fois) ; clé d’upload (voir « Tester sur téléphone », secrets `ANDROID_*`) :
   chaque release contient alors aussi `gaspalli-X.Y.Z-play-store.aab`, à téléverser dans la Play Console.
   Textes, visuels et réponses au formulaire « Sécurité des données » : `docs/store/fiche-play-store.md`.
   Google demande aux nouveaux comptes personnels un test fermé (une douzaine de testeurs pendant deux semaines)
   avant la mise en production.
6. **App Store** (plus tard) — compte Apple Developer (99 $/an), build iOS (EAS ou Mac) ; la connexion Apple est prête.

Icônes : `node scripts/generate-icons.js` ; captures et bannière du store : `scripts/store-screenshots.js`,
`scripts/generate-store-banner.js`.

## Structure

```
app/                 Expo Router (onglets, scan en modale plein écran)
src/theme/           tokens (couleurs clair/sombre, fraîcheur, typo, rayons), ThemeProvider
src/components/ui/   Text, Button, Card, Chip, FreshnessBadge, ProductCard, BottomSheet, Stepper…
src/domain/          logique métier pure et testée (fraîcheur, dates, catégories, inventaire, quantités)
src/db/              SQLite (expo-sqlite) + Drizzle : schéma, migrations versionnées, dépôts
src/features/        écrans et hooks par fonctionnalité
src/services/        Open Food Facts, OCR (ML Kit), Supabase
modules/gaspalli-ocr module Expo local : OCR ligne par ligne avec positions (tickets de caisse)
src/sync/            file d'attente locale, moteur de synchro, application des lignes reçues
supabase/            migrations SQL (RLS, foyers, sync_push), tests SQL, guide de mise en place
src/data/            données (démo à l'étape 1, recettes JSON plus tard)
__tests__/           tests Jest
docs/captures/       captures à chaque étape
```

## Avancement

- [x] 1. Socle : Expo, design system, navigation, thème clair/sombre/auto
- [x] 2. Inventaire (SQLite + Drizzle, glisser consommé/jeté, ajout manuel, fiche produit)
- [x] 3. Scan (caméra, Open Food Facts + cache, produit inconnu, mode rafale, OCR de la date)
- [x] 4. Comptes et foyer (Supabase : auth, RLS, invitations, synchro hors ligne champ par champ)
- [x] 5. Accueil et notifications (alertes, stats du mois, rappel quotidien + veille de DLC, 1 notification/jour max)
- [x] 6. Recettes (68 recettes, moteur anti-gaspi, recettes perso avec tags et dossiers, favoris, préférences alimentaires, « J'ai cuisiné ça »)
- [x] 7. IA recettes (Edge Function Supabase + API Claude, quota et cache, revalidation des allergènes)
- [x] 8. Courses (rangement dans l'inventaire, produits habituels), planning des repas (semaine anti-gaspi, réservations, manquants), statistiques
- [x] 9. Scan du ticket (OCR avec positions des lignes, abréviations, remises, pesées, apprentissage par foyer, prix pour les statistiques)
- [x] Import de recettes : lien d'un site (schema.org/Recipe), photo d'un livre ou d'une fiche (OCR), fichier
- [x] 10. Publication (présentation, confidentialité RGPD, export/suppression, suppression de compte, À propos, Sentry, icônes, CI de release, fiche Play Store)
