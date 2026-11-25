// @ts-check
/**
 * « Partager vers Gaspalli » (Android) : l'activité principale accepte le texte partagé
 * par une autre app (lien d'une recette depuis le navigateur, Marmiton…).
 */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SEND_FILTER = {
  action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
  category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
  data: [{ $: { 'android:mimeType': 'text/plain' } }],
};

/** @param {import('expo/config-plugins').AndroidConfig.Manifest.AndroidManifest} manifest */
function applyShareIntent(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const filters = (activity['intent-filter'] = activity['intent-filter'] ?? []);
  const exists = filters.some((f) => f.action?.some((a) => a.$['android:name'] === 'android.intent.action.SEND'));
  if (!exists) filters.push(/** @type {any} */ (SEND_FILTER));
  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withShareIntent = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults = applyShareIntent(c.modResults);
    return c;
  });

module.exports = withShareIntent;
module.exports.applyShareIntent = applyShareIntent;
