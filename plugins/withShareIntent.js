// @ts-check
/**
 * « Partager vers Gaspalli » (Android) : l'activité principale accepte le texte et les images
 * partagés par une autre app (lien de recette, e-mail ou capture de commande drive, ticket).
 */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/** Texte (lien de recette, e-mail de commande) et images (tickets, captures, photos de recettes). */
const FILTERS = [
  ['android.intent.action.SEND', 'text/plain'],
  ['android.intent.action.SEND', 'image/*'],
  ['android.intent.action.SEND_MULTIPLE', 'image/*'],
].map(([action, mimeType]) => ({
  action: [{ $: { 'android:name': action } }],
  category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
  data: [{ $: { 'android:mimeType': mimeType } }],
}));

/** @param {import('expo/config-plugins').AndroidConfig.Manifest.AndroidManifest} manifest */
function applyShareIntent(manifest) {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  const filters = (activity['intent-filter'] = activity['intent-filter'] ?? []);
  for (const filter of FILTERS) {
    const exists = filters.some(
      (f) =>
        f.action?.some((a) => a.$['android:name'] === filter.action[0].$['android:name']) &&
        f.data?.some((d) => d.$['android:mimeType'] === filter.data[0].$['android:mimeType']),
    );
    if (!exists) filters.push(/** @type {any} */ (filter));
  }
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
