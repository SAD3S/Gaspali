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

## Structure

```
app/                 Expo Router (onglets, scan en modale plein écran)
src/theme/           tokens (couleurs clair/sombre, fraîcheur, typo, rayons), ThemeProvider
src/components/ui/   Text, Button, Card, Chip, FreshnessBadge, ProductCard, BottomSheet, Stepper…
src/domain/          logique métier pure et testée (fraîcheur, dates…)
src/data/            données (démo à l'étape 1, recettes JSON plus tard)
__tests__/           tests Jest
docs/captures/       captures à chaque étape
```

## Avancement

- [x] 1. Socle : Expo, design system, navigation, thème clair/sombre/auto
- [ ] 2. Inventaire (SQLite + Drizzle, glisser consommé/jeté)
- [ ] 3. Scan (caméra, Open Food Facts, OCR de la date)
- [ ] 4. Comptes et foyer (Supabase)
- [ ] 5. Accueil et notifications
- [ ] 6. Recettes (dont recettes perso avec tags et dossiers)
- [ ] 7. IA recettes
- [ ] 8. Courses, planning, statistiques
- [ ] 9. Scan du ticket
- [ ] 10. Publication
