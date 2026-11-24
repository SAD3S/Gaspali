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

En développement, « Plus › Charger des produits de démo » remplit l'inventaire
et met en cache le code-barres `3260000000012` (à saisir via « Saisir le code » sur l'écran de scan).

## Tester sur téléphone

- **Expo Go** : `npm start` puis scanner le QR code. Tout fonctionne sauf la lecture de la date (OCR ML Kit),
  qui demande l'app compilée.
- **APK Android (GitHub Actions)** : pousser un tag `vX.Y.Z` lance `.github/workflows/android-release.yml`,
  qui vérifie (types + tests), compile l'APK et le publie dans une Release GitHub.
  ```bash
  git tag v0.2.0 && git push origin v0.2.0
  ```
  Signature : sans secrets, la clé de debug standard est utilisée (OK pour tester). Pour une vraie clé :
  ```bash
  keytool -genkeypair -v -keystore gaspalli-upload.keystore -alias gaspalli -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 gaspalli-upload.keystore   # → secret ANDROID_KEYSTORE_BASE64
  ```
  puis les secrets `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`gaspalli`) et `ANDROID_KEY_PASSWORD`
  (Settings › Secrets and variables › Actions). ⚠️ Changer de clé impose de désinstaller l'app une fois.
- **EAS (optionnel)** : profils `development` / `preview` / `production` dans `eas.json`.
  Les dossiers natifs `android/` et `ios/` sont générés (`npx expo prebuild`) et ne sont pas versionnés.

## Structure

```
app/                 Expo Router (onglets, scan en modale plein écran)
src/theme/           tokens (couleurs clair/sombre, fraîcheur, typo, rayons), ThemeProvider
src/components/ui/   Text, Button, Card, Chip, FreshnessBadge, ProductCard, BottomSheet, Stepper…
src/domain/          logique métier pure et testée (fraîcheur, dates, catégories, inventaire, quantités)
src/db/              SQLite (expo-sqlite) + Drizzle : schéma, migrations versionnées, dépôts
src/features/        écrans et hooks par fonctionnalité
src/services/        Open Food Facts, OCR (ML Kit), Supabase
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
- [x] 6. Recettes (52 recettes, moteur anti-gaspi, recettes perso avec tags et dossiers, favoris, préférences alimentaires, « J'ai cuisiné ça »)
- [ ] 7. IA recettes
- [ ] 8. Courses, planning, statistiques
- [ ] 9. Scan du ticket
- [ ] 10. Publication
