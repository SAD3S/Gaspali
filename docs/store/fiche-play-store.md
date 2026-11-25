# Fiche Play Store

Textes prêts à coller dans la Play Console (*Présence sur le Play Store › Fiche principale*).

## Fiche

**Nom de l'application** (30 caractères max.)

> Gaspalli – Anti-gaspi frigo

**Description courte** (80 caractères max.)

> Scanne tes courses, finis ce qui périme en premier et cuisine sans gaspiller.

**Description complète**

> Gaspalli t'aide à ne plus jeter de nourriture.
>
> 🛒 TES COURSES EN QUELQUES SECONDES
> • Scanne le code-barres : nom, marque et allergènes grâce à Open Food Facts.
> • Photographie la date limite : Gaspalli la lit pour toi.
> • Ou scanne directement ton ticket de caisse : tous les produits d'un coup, avec leurs prix.
>
> ⏰ RIEN NE PÉRIME EN DOUCE
> • Ton frigo, ton congélateur et ton placard triés par urgence, d'un coup d'œil.
> • Un seul rappel par jour, seulement quand il y a des produits à finir.
> • DLC ou DDM : Gaspalli fait la différence (« à vérifier » plutôt que « périmé »).
>
> 🍳 CUISINE CE QUI DOIT PARTIR
> • Plus de 50 recettes qui utilisent d'abord tes produits les plus urgents.
> • Tes propres recettes, rangées en dossiers et en tags.
> • Allergies et régimes de chacun respectés.
> • « Planifier ma semaine anti-gaspi » : un planning midi et soir en un geste, et les manquants envoyés aux courses.
>
> 👨‍👩‍👧 EN FOYER
> • Frigo, courses et planning partagés en temps réel avec ton foyer.
> • Fonctionne aussi hors ligne : tout se synchronise au retour du réseau.
>
> 📊 TES PROGRÈS
> • Produits sauvés et jetés chaque mois, en euros.
>
> 🔒 RESPECTUEUSE DE TES DONNÉES
> • Pas de publicité, rien n'est revendu.
> • Sans compte, tout reste sur ton téléphone.
> • Export et suppression de tes données à tout moment.

**Catégorie** : Alimentation et boissons · **Tags** : cuisine, liste de courses, anti-gaspillage

**Visuels** (dans ce dossier)

- Icône 512×512 : `icone-512.png`
- Bannière 1024×500 : `banniere-1024x500.png`
- Captures téléphone 1080×1920 : `captures/1-accueil.png` … `captures/6-statistiques.png`

## Contenu de l'application

**Politique de confidentialité** : URL de `docs/confidentialite.md` publiée (GitHub Pages, cf. README).

**Annonces** : non.

**Accès à l'application** : toutes les fonctionnalités sont accessibles sans compte, sauf le partage en foyer et
les idées de recettes par IA. Fournir un compte de test (e-mail + code) si Google le demande.

**Classification du contenu** (questionnaire IARC) : aucune violence, sexualité, langage grossier, substance,
jeu d'argent ; pas d'échanges entre utilisateurs inconnus (le foyer se rejoint uniquement par code d'invitation).

**Public cible** : 18 ans et plus (ou 13 ans et plus) ; l'app ne vise pas les enfants.

**Suppression de compte** : dans l'app (*Plus › Confidentialité et données › Supprimer mon compte*) et par une page web :
URL de `docs/suppression-compte.md` publiée.

## Sécurité des données (formulaire Play Console)

Réponses pour une version **avec** projet Supabase (comptes) et Sentry (plantages). Sans compte, aucune donnée
ne quitte le téléphone, hormis les codes-barres envoyés à Open Food Facts.

| Question | Réponse |
|---|---|
| L'app collecte-t-elle ou partage-t-elle des données ? | Oui (collecte) |
| Toutes les données sont-elles chiffrées en transit ? | Oui |
| Les utilisateurs peuvent-ils demander la suppression ? | Oui (dans l'app et par la page web) |
| Données partagées avec des tiers | Aucune (Supabase, Anthropic et Sentry sont des sous-traitants agissant pour le compte de l'éditeur) |

Données collectées :

| Type (Play) | Collecté | Facultatif | Finalité |
|---|---|---|---|
| Infos personnelles › Adresse e-mail | Oui | Oui (compte facultatif) | Gestion du compte |
| Infos personnelles › Nom | Oui (prénom affiché) | Oui | Fonctionnalités de l'app |
| Infos financières › Historique des achats | Oui (produits achetés, prix des tickets) | Oui | Fonctionnalités de l'app |
| Santé et remise en forme › Infos de santé | Oui (allergies et intolérances) | Oui | Fonctionnalités de l'app |
| Activité dans l'app › Autre contenu généré par l'utilisateur | Oui (inventaire, recettes, courses, planning) | Oui | Fonctionnalités de l'app |
| Infos et performances de l'app › Journaux de plantage, Diagnostics | Oui si Sentry est configuré | Oui (désactivable) | Analyse (correction de bugs) |

Non collectés : position, contacts, photos et vidéos (lues sur le téléphone, jamais envoyées), fichiers,
identifiants publicitaires, historique de navigation.

## App Store (plus tard)

Mêmes textes. *Confidentialité de l'app* : « Données liées à l'utilisateur » = e-mail, nom, historique d'achats,
données de santé, contenu utilisateur (fonctionnalités de l'app) ; « Données non liées » = plantages et
diagnostics (si Sentry). Pas de suivi (« tracking »). Connexion Apple déjà prévue (obligatoire avec Google).
