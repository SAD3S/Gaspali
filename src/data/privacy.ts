/**
 * Politique de confidentialité : source unique, affichée dans l'app (Paramètres › Confidentialité)
 * et publiée en page web pour les stores (`docs/confidentialite.md`, régénérée par
 * `UPDATE_PRIVACY=1 npx jest __tests__/privacy.test.ts`).
 */

export const PRIVACY_UPDATED = '25 novembre 2026';

export interface PrivacySection {
  title: string;
  /** Paragraphes, ou puces si `bullets`. */
  items: string[];
  bullets?: boolean;
}

export function privacySections(contact: string | null): PrivacySection[] {
  const reach = contact ? `par e-mail à ${contact}` : 'via la page de l’application sur le Play Store ou l’App Store';
  return [
    {
      title: 'En bref',
      bullets: true,
      items: [
        'Tes données servent uniquement à faire fonctionner Gaspalli : ton inventaire, tes courses, tes recettes.',
        'Pas de publicité, pas de revente, pas de pistage.',
        'Sans compte, tout reste sur ton téléphone.',
        'Tu peux exporter ou effacer tes données à tout moment, depuis l’app (Paramètres › Confidentialité).',
      ],
    },
    {
      title: 'Qui est responsable de tes données ?',
      items: [`L’éditeur de l’application Gaspalli. Pour toute question ou demande, contacte-le ${reach}.`],
    },
    {
      title: 'Les données utilisées',
      bullets: true,
      items: [
        'Sur ton téléphone : produits de l’inventaire et leur historique (consommé, jeté), prix, recettes perso et photos de recettes, liste de courses, planning des repas, préférences alimentaires, réglages.',
        'Avec un compte (pour partager avec ton foyer) : ton adresse e-mail pour te connecter, le prénom que tu affiches, les foyers dont tu es membre, et les données ci-dessus, partagées en temps réel avec les membres du foyer.',
        'Allergies et intolérances : elles peuvent révéler des informations sur ta santé. Tu les indiques seulement si tu le souhaites ; elles servent uniquement à écarter les recettes qui pourraient te rendre malade et sont visibles par les membres de ton foyer. Tu peux les retirer à tout moment.',
      ],
    },
    {
      title: 'Ce qui ne quitte jamais ton téléphone',
      bullets: true,
      items: [
        'Les photos prises pour lire une date limite ou un ticket de caisse : le texte est lu sur le téléphone, la photo n’est ni envoyée ni conservée.',
        'La caméra : utilisée seulement pendant un scan.',
        'Les rappels : programmés sur le téléphone, sans serveur de notifications.',
      ],
    },
    {
      title: 'Les services utilisés',
      bullets: true,
      items: [
        'Supabase (hébergement des comptes et des foyers, serveurs en Europe) : seulement si tu crées un compte.',
        'Open Food Facts (base de données ouverte des produits alimentaires) : quand tu scannes un code-barres que Gaspalli ne connaît pas, ce code est envoyé pour trouver le produit. Aucune donnée personnelle n’est envoyée.',
        'Anthropic (intelligence artificielle Claude) : seulement quand tu demandes une idée de recette par IA. Sont envoyés les produits à utiliser, ton envie, le temps et le nombre de portions, ainsi que les régimes, allergies et aliments évités de ton foyer ; jamais ton nom ni ton e-mail. Anthropic agit comme sous-traitant, n’utilise pas ces données pour entraîner ses modèles, et peut les traiter aux États-Unis avec les garanties prévues par le RGPD.',
        'Sentry (rapports de plantage) : si l’app plante, un rapport technique est envoyé (modèle et système du téléphone, version de l’app, endroit du code concerné), sans ton nom, ton e-mail ni le contenu de ton inventaire. Tu peux le désactiver dans Réglages.',
        'Google ou Apple : seulement si tu choisis de te connecter avec eux ; ils confirment ton identité (e-mail, nom).',
      ],
    },
    {
      title: 'Sur quelle base ?',
      bullets: true,
      items: [
        'Le service que tu demandes : inventaire, partage en foyer, synchronisation, idées de recettes.',
        'Ton consentement : pour les allergies et intolérances que tu choisis d’indiquer. Tu le retires en les supprimant.',
        'L’intérêt légitime : corriger les plantages grâce à des rapports techniques, que tu peux refuser.',
      ],
    },
    {
      title: 'Combien de temps ?',
      bullets: true,
      items: [
        'Tant que ton compte existe. Quand tu le supprimes, ton profil, tes préférences et les foyers dont tu es le seul membre sont effacés immédiatement ; dans un foyer partagé, ce que tu as ajouté reste aux autres membres, sans ton nom.',
        'Sans compte : jusqu’à ce que tu effaces les données ou désinstalles l’app.',
        'Les idées de recettes IA demandées par le foyer sont gardées avec lui (limite quotidienne et réponses déjà connues).',
        'Les rapports de plantage sont supprimés automatiquement par Sentry après une durée limitée.',
      ],
    },
    {
      title: 'Tes droits',
      bullets: true,
      items: [
        'Accès et portabilité : Paramètres › Confidentialité › « Exporter mes données » (fichier JSON).',
        'Rectification : directement dans l’app.',
        'Effacement : Paramètres › Confidentialité › « Supprimer mon compte », ou « Effacer mes données » sans compte.',
        'Opposition : désactive les rapports de plantage dans Réglages.',
        `Pour toute autre demande, contacte l’éditeur ${reach}. Tu peux aussi adresser une réclamation à la CNIL (cnil.fr).`,
      ],
    },
    {
      title: 'Sécurité',
      items: [
        'Les échanges avec le serveur sont chiffrés. Les données d’un foyer ne sont accessibles qu’à ses membres, contrôle fait par le serveur lui-même. Les clés des services payants (IA) ne sont jamais dans l’application.',
      ],
    },
    {
      title: 'Mises à jour',
      items: [`Dernière mise à jour : ${PRIVACY_UPDATED}. En cas de changement important, l’app te le signalera.`],
    },
  ];
}

/** Version Markdown (page web pour les stores). */
export function privacyMarkdown(contact: string | null): string {
  const parts = ['# Politique de confidentialité de Gaspalli', ''];
  for (const s of privacySections(contact)) {
    parts.push(`## ${s.title}`, '');
    for (const item of s.items) parts.push(s.bullets ? `- ${item}` : item, ...(s.bullets ? [] : ['']));
    if (s.bullets) parts.push('');
  }
  return `${parts.join('\n').trimEnd()}\n`;
}
