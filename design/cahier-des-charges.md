# Prompt — Développement de l'app Gaspalli

> À coller dans Claude Code (ou un autre agent de dev). Place aussi le fichier `Gaspalli – Proposition visuelle.html` dans le repo, dans `/design/`, pour qu'il serve de référence visuelle.

---

## Contexte

Tu vas développer **Gaspalli**, une application mobile anti-gaspillage alimentaire. Slogan : *« Moins de gaspi, plus de goût. »*

L'utilisateur scanne ses courses, l'app garde un inventaire de ce qu'il y a dans le frigo, le congélateur et le placard, le prévient avant que les produits périment et lui propose des recettes qui utilisent en priorité ce qui périme bientôt.

Trois mots guident toute l'expérience : **rassurant, rapide, lisible d'un coup d'œil**. Ajouter un produit doit prendre moins de 5 secondes.

Une maquette visuelle complète existe dans `/design/Gaspalli – Proposition visuelle.html` (écrans Accueil, Inventaire, Ajout après scan, en clair et en sombre, plus la planche identité/composants). **Respecte-la fidèlement** : couleurs, typo, rayons, hiérarchie, libellés.

## Stack technique

- **React Native + Expo** (TypeScript strict), iOS et Android
- Navigation : Expo Router
- Stockage local d'abord : SQLite (`expo-sqlite`) + Drizzle ORM. L'app doit marcher hors ligne.
- Backend : **Supabase** (auth, Postgres, Row Level Security, Realtime, Storage pour les photos, Edge Functions). Synchronisation locale ↔ cloud quand le réseau revient, résolution des conflits « dernière modification gagne » par champ.
- IA recettes : **API Claude** appelée uniquement depuis une Edge Function Supabase. La clé API ne doit jamais se trouver dans l'app.
- Build et publication : **EAS Build / EAS Submit**
- Scan code-barres : `expo-camera` (EAN-13, EAN-8, UPC-A, UPC-E)
- Lecture de la date sur l'emballage (OCR) : ML Kit Text Recognition (on-device)
- Notifications locales : `expo-notifications`
- Données produits : API **Open Food Facts** (`https://world.openfoodfacts.org/api/v2/product/{barcode}.json`), avec cache local des produits déjà scannés
- Tests : Jest + React Native Testing Library pour la logique métier

Si tu juges qu'un choix ci-dessus est mauvais, explique pourquoi avant de changer.

## Design system (repris de la maquette)

**Typographie**
- Titres : Bricolage Grotesque (Titre 1 : 34/800, Titre 2 : 22/700)
- Texte : DM Sans (Corps fort 17/700, Corps 15/400, Étiquette 13/500)

**Couleurs — thème clair / sombre**

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#F3F6F1` | `#0F1613` |
| Surface | `#FFFFFF` | `#18221D` |
| Surface 2 | `#E9EFE7` | `#212D27` |
| Bordure | `#D8E1D6` | `#2C3A33` |
| Texte | `#14211B` | `#E9F0EB` |
| Texte secondaire | `#56665D` | `#9AABA1` |
| Principale | `#1F7A4D` | `#4CC38A` |
| Sur principale | `#FFFFFF` | `#0B1F15` |
| Texte principal | `#17603C` | `#7DDBA8` |
| Principale douce | `#DDEFE3` | `#1D3A2B` |
| Urgence (accent) | `#E8573A` | `#FF7A5C` |
| Barre de nav | `#FFFFFF` | `#141D19` |

**Échelle de fraîcheur** — chaque état combine couleur + libellé + forme de pastille (jamais la couleur seule, pour l'accessibilité) :

| État | Règle | Fond clair / texte | Fond sombre / texte | Forme |
|---|---|---|---|---|
| Frais | plus de 5 jours | `#DDEFE3` / `#17603C` | `#1D3A2B` / `#7DDBA8` | rond |
| Bientôt | 3 à 5 jours | `#FBEFC9` / `#6E5100` | `#3A3115` / `#F5CF6B` | rond |
| Urgent | aujourd'hui à 2 jours | `#FCE1D9` / `#A3301A` | `#43231B` / `#FF9A80` | carré arrondi (2px) |
| Périmé | DLC dépassée | `#F7D9E0` / `#8E1A34` | `#3F1A24` / `#FF8FA5` | carré (0) |
| À vérifier | DDM dépassée, souvent encore bon | `#E6E3F4` / `#4E4390` | `#2A2640` / `#B8AEF0` | carré arrondi (2px) |

**Formes** : cartes 20–24px de rayon, boutons 14px, chips 999px. Bouton de scan central 62×62, rayon 22, en relief au-dessus de la barre de nav.

Le thème suit le réglage du téléphone, avec un choix manuel dans les réglages.

## Navigation

Barre du bas à 5 entrées : **Accueil · Inventaire · [Scan central] · Courses · Plus**. Le bouton scan est toujours accessible au pouce. Les recettes et le planning des repas sont accessibles depuis l'Accueil et depuis « Plus » ; propose-moi une solution si tu penses qu'ils méritent un onglet.

## Fonctionnalités

### 1. Scan et ajout de produits (écran « Ajout après scan »)
- Vue caméra plein écran, bouton fermer, bouton lampe torche.
- **Mode rafale** : on enchaîne les scans sans quitter la caméra, compteur visible (« Mode rafale · 3 »).
- Au scan, interroger Open Food Facts → nom, marque, quantité, catégorie, image, Nutri-Score. Afficher « Trouvé via Open Food Facts ».
- Si produit inconnu : saisie manuelle rapide (nom + catégorie), et on mémorise ce code-barres pour la prochaine fois.
- **Feuille de confirmation** (bottom sheet) :
  - Type de date : bascule **DLC** (« à consommer jusqu'au ») / **DDM** (« à consommer de préférence avant »). Proposer une valeur par défaut selon la catégorie.
  - Raccourcis : **+3 j, +1 sem., +2 sem., +1 mois**, plus un sélecteur de date.
  - Bouton **« Lire la date »** : OCR de la date imprimée sur l'emballage (formats FR : `JJ/MM/AA`, `JJ/MM/AAAA`, `JJ.MM.AA`, `JJ MM`, `MM/AAAA`…). Toujours faire confirmer.
  - Affichage clair : « Jusqu'au **vendredi 20 novembre** ».
  - Quantité (− / +) et unité.
  - Emplacement : **Frigo / Congélo / Placard**. Valeur par défaut déduite de la catégorie.
  - Bouton principal : **« Ajouter et scanner le suivant »**.
- Ajout sans code-barres possible (fruits, légumes, vrac, restes maison) avec une liste de produits frais courants et des durées de conservation par défaut.
- Quand on passe un produit au congélateur, proposer de prolonger la date (durées par catégorie).

### 1 bis. Scan du ticket de caisse
- Depuis l'écran de scan, onglet « Ticket » : photo du ticket, OCR on-device, puis découpage en lignes (nom abrégé, quantité, prix).
- Gérer les abréviations des tickets français (« YAOURT NAT X4 », « BLC POULET »…) : correspondance floue avec les produits déjà connus et la table d'ingrédients, et apprentissage des correspondances validées par l'utilisateur.
- Écran de revue en liste : chaque ligne reconnue avec emplacement et date limite proposés par défaut selon la catégorie, modifiables d'un toucher ; ignorer les lignes non alimentaires (sacs, remises, produits ménagers).
- Les prix récupérés alimentent les statistiques en €.
- Le ticket ne donne pas les dates : bien indiquer que ce sont des estimations, avec un badge « date estimée » jusqu'à confirmation.

### 1 ter. Foyer partagé
- Compte utilisateur (e-mail + Sign in with Apple + Google).
- Un utilisateur crée un **foyer** et invite les autres membres par lien ou code. Inventaire, courses, planning et recettes perso sont partagés au sein du foyer, en temps réel.
- Historique « ajouté par Léa », « consommé par Tom ».
- L'app reste utilisable sans réseau ; synchronisation au retour de la connexion.

### 2. Inventaire
- Titre + compteur (« 76 produits »), recherche, filtres **Tout / Frigo / Congélo / Placard**, tri par date limite par défaut (autres tris : nom, date d'ajout).
- Carte produit : pastille avec initiales (ou photo), nom, sous-titre (« 2 filets · Frigo »), badge de fraîcheur (« Aujourd'hui », « Demain », « Dans 3 j », « À vérifier »).
- **Glisser** une carte pour la marquer **Consommé** (vert) ou **Jeté** (rouge). Une action d'annulation apparaît quelques secondes.
- Consommation partielle (« entamé », il en reste la moitié…).
- Fiche produit au toucher : modifier date, quantité, emplacement, voir l'historique.

### 3. Accueil
- En-tête : date du jour + « Bonjour ! » + cloche de notifications (point rouge s'il y a des alertes).
- Carte **« À consommer vite »** : les 3 produits les plus urgents + lien « Tout voir ».
- Trois tuiles compteurs : **Frigo, Congélo, Placard**.
- Carte verte **« Idée anti-gaspi »** : une recette suggérée, durée, « utilise 3 de tes produits urgents », bouton « Voir la recette ».
- Carte **« Ce mois-ci »** : montant jeté en € et % de produits sauvés, barre de progression.

### 4. Recettes
- **Moteur de suggestion** qui classe les recettes par score :
  - poids fort pour chaque ingrédient urgent ou bientôt périmé utilisé,
  - bonus si tous les ingrédients sont déjà disponibles,
  - malus pour chaque ingrédient manquant,
  - les ingrédients de base (sel, poivre, huile, farine…) sont considérés comme disponibles et configurables.
- Correspondance ingrédients ↔ produits de l'inventaire tolérante (« blanc de poulet » correspond à « poulet », gestion des pluriels et accents). Prévoir une table d'ingrédients normalisés.
- Fiche recette : photo, durée, portions ajustables, ingrédients (avec indication « dans ton frigo », « périme bientôt », « manquant »), étapes.
- Bouton **« J'ai cuisiné ça »** : décrémente automatiquement les ingrédients utilisés de l'inventaire (avec confirmation).
- Bouton « Ajouter les manquants aux courses ».
- **Recettes personnelles** : l'utilisateur crée, modifie et supprime ses recettes (titre, photo, durée, portions, ingrédients avec quantités, étapes, tags). Elles entrent dans le moteur de suggestion comme les autres.
- Livrer une base de départ d'environ 50 recettes simples du quotidien, en français, stockées en JSON dans l'app.
- Filtres : durée, végétarien, favoris, mes recettes.
- **Recettes générées par IA** (bouton « Invente-moi une recette ») :
  - L'Edge Function envoie à Claude la liste des produits disponibles, les produits urgents à utiliser en priorité, les préférences alimentaires du foyer, le temps disponible et le nombre de personnes.
  - Réponse en JSON structuré au même format que les recettes de la base (validé côté serveur avec un schéma ; rejet et nouvelle tentative si invalide).
  - La recette générée peut être enregistrée dans « Mes recettes ».
  - Limiter le nombre de générations par foyer et par jour pour maîtriser les coûts, et mettre en cache les réponses.
  - Les allergies déclarées sont un filtre strict, revérifié après génération.

### 4 bis. Préférences alimentaires
- Par membre du foyer : régime (omnivore, végétarien, végan, pescétarien), allergies et intolérances (les 14 allergènes réglementaires UE), aliments détestés.
- Les recettes qui contiennent un allergène déclaré ne sont jamais proposées. Les autres préférences baissent le score.
- Au scan, si Open Food Facts signale un allergène déclaré par un membre, afficher un avertissement.

### 4 ter. Planning des repas
- Vue semaine (midi / soir), glisser une recette sur un créneau.
- Bouton **« Planifier ma semaine anti-gaspi »** : remplit automatiquement les créneaux libres en plaçant d'abord les recettes qui utilisent les produits qui périment le plus tôt.
- Les ingrédients des repas planifiés sont « réservés » dans l'inventaire et les manquants peuvent être ajoutés aux courses en un toucher.
- Le planning est partagé dans le foyer.

### 5. Courses
- Liste de courses avec cases à cocher, regroupée par rayon.
- Ajout manuel, depuis une recette, ou automatique quand un produit habituel est terminé.
- Un article coché peut passer directement dans l'inventaire (avec la feuille de date).

### 6. Notifications
- Rappel quotidien à une heure réglable (par défaut 18h) : « 3 produits à consommer d'ici demain », avec la recette du jour.
- Alerte la veille de la DLC.
- Ne jamais envoyer plus d'une notification groupée par jour par défaut.

### 7. Statistiques (dans « Plus »)
- Produits sauvés vs jetés, par mois.
- Estimation en € (prix saisi ou prix moyen par catégorie).
- Catégories les plus jetées.

### 8. Plus / Réglages
- Thème, heure des notifications, ingrédients de base, durées par défaut, export/import des données (JSON).

## Modèle de données (à affiner)

- `Product` : code-barres, nom, marque, catégorie, image, quantité par défaut, source (OFF / manuel)
- `InventoryItem` : produit, quantité, unité, emplacement, type de date (DLC/DDM), date limite, date d'ajout, ouvert le, statut (en stock / consommé / jeté), prix
- `Recipe` : titre, photo, durée, portions, étapes, tags, source (intégrée / perso), favori
- `RecipeIngredient` : recette, ingrédient normalisé, quantité, unité, optionnel
- `Ingredient` : nom normalisé, synonymes, catégorie
- `ShoppingItem` : nom, quantité, rayon, coché
- `Event` : historique (ajout, consommé, jeté) pour les stats, avec l'auteur
- `Household` et `HouseholdMember` : foyer, membres, rôle (admin / membre), code d'invitation
- `DietaryProfile` : membre, régime, allergènes, aliments exclus
- `MealPlanEntry` : foyer, date, créneau, recette, portions
- `ReceiptAlias` : libellé de ticket → produit / ingrédient (appris par foyer)

Toutes les tables partagées portent un `household_id`, protégé par des règles RLS : un utilisateur ne voit que les données de ses foyers.

## Règles métier importantes

- Calcul du statut de fraîcheur centralisé dans une seule fonction testée, selon les seuils du tableau ci-dessus.
- **DLC dépassée** → « Périmé » (ne pas suggérer en recette). **DDM dépassée** → « À vérifier » (peut être suggéré, avec mention).
- Un produit ouvert peut avoir une durée raccourcie (ex. crème fraîche ouverte : 3 jours).
- Les libellés de date sont relatifs : « Aujourd'hui », « Demain », « Dans 3 j », « Hier », « Il y a 2 j ».

## Accessibilité

- Contrastes conformes WCAG AA dans les deux thèmes.
- Labels d'accessibilité sur tous les boutons icône (déjà présents dans la maquette).
- Cibles tactiles d'au moins 44×44.
- Support de la taille de texte système.

## Publication sur les stores

L'app est destinée à être publiée sur l'App Store et le Play Store :
- Textes d'autorisation clairs en français (caméra : « pour scanner tes produits et tickets » ; notifications).
- **Suppression de compte depuis l'app** (exigée par Apple), avec suppression réelle des données côté serveur.
- Conformité RGPD : politique de confidentialité, export des données, consentement explicite si analytics.
- Attribution d'Open Food Facts (licence ODbL) dans l'écran « À propos ».
- Onboarding en 3 écrans, puis création ou rejoindre un foyer.
- Icône, splash screen et captures d'écran aux couleurs de la maquette.
- Gestion des erreurs et suivi des crashs (Sentry).
- Configuration EAS (profils development / preview / production) et variables d'environnement séparées.

## Méthode de travail

Avance par étapes et montre-moi le résultat à chaque fin d'étape :

1. **Socle** : projet Expo, design system (tokens, typo, composants : bouton, carte produit, badge de fraîcheur, chips, bottom sheet), navigation, thème clair/sombre.
2. **Inventaire** : base de données locale, ajout manuel, écran Inventaire, glisser consommé/jeté, logique de fraîcheur + tests.
3. **Scan** : caméra, Open Food Facts, feuille de confirmation, mode rafale, OCR de la date.
4. **Comptes et foyer** : Supabase, auth, schéma + RLS, invitations, synchronisation hors ligne.
5. **Accueil** et **notifications**.
6. **Recettes** : base de départ, moteur de suggestion + tests, fiche recette, « J'ai cuisiné ça », recettes perso, préférences alimentaires.
7. **IA recettes** : Edge Function Claude, schéma JSON, quotas, cache.
8. **Courses**, **planning des repas** et **statistiques**.
9. **Scan du ticket de caisse**.
10. **Publication** : onboarding, suppression de compte, RGPD, états vides / erreurs, Sentry, EAS.

Avant de commencer, lis la maquette, propose l'arborescence du projet et pose-moi tes questions s'il reste des points flous.
