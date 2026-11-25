/**
 * Configuration publique de l'app (variables EXPO_PUBLIC_*, intégrées au build ; jamais de secret ici).
 * Vides → la fonctionnalité correspondante est simplement masquée ou désactivée.
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Adresse de contact de l'éditeur (politique de confidentialité, À propos). */
export const CONTACT_EMAIL = clean(process.env.EXPO_PUBLIC_CONTACT_EMAIL);
/** Page web de la politique de confidentialité (exigée par les stores). */
export const PRIVACY_URL = clean(process.env.EXPO_PUBLIC_PRIVACY_URL);
/** DSN Sentry : sans lui, aucun rapport de plantage n'est envoyé. */
export const SENTRY_DSN = clean(process.env.EXPO_PUBLIC_SENTRY_DSN);
/** development | preview | production (profils EAS / CI). */
export const APP_ENV = clean(process.env.EXPO_PUBLIC_APP_ENV) ?? 'development';
/** Connexion Google : à activer seulement quand le fournisseur Google est configuré dans Supabase. */
export const GOOGLE_SIGN_IN = process.env.EXPO_PUBLIC_AUTH_GOOGLE === '1';
