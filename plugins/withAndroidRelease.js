// @ts-check
/**
 * Plugin de configuration Android (appliqué par `expo prebuild`) :
 * 1. Signature des builds release avec la clé d'upload si elle est fournie
 *    (variables GASPALLI_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD),
 *    sinon avec la clé de debug standard (suffisant pour tester en sideload).
 * 2. Téléchargement du modèle ML Kit de reconnaissance de texte dès l'installation
 *    (sinon il est téléchargé au premier « Lire la date »).
 */
const { AndroidConfig, withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            def uploadStore = System.getenv('GASPALLI_UPLOAD_STORE_FILE')
            if (uploadStore) {
                storeFile file(uploadStore)
                storePassword System.getenv('GASPALLI_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('GASPALLI_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('GASPALLI_UPLOAD_KEY_PASSWORD')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

/** @param {string} gradle */
function applySigning(gradle) {
  if (gradle.includes("GASPALLI_UPLOAD_STORE_FILE")) return gradle;
  const withConfig = gradle.replace(/signingConfigs\s*\{\s*\n(\s*)debug\s*\{[\s\S]*?\n\s*\}/, (m) => `${m}${RELEASE_SIGNING}`);
  // Ne modifier que le type de build « release » (pas le bloc signingConfigs ni « debug »).
  const start = withConfig.indexOf('buildTypes {');
  if (start < 0) throw new Error('withAndroidRelease : bloc buildTypes introuvable');
  const head = withConfig.slice(0, start);
  const tail = withConfig
    .slice(start)
    .replace(/(\n\s*release\s*\{[^}]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  const withUse = head + tail;
  if (withUse === gradle || !withUse.includes('signingConfig signingConfigs.release')) {
    throw new Error('withAndroidRelease : impossible de configurer la signature dans app/build.gradle');
  }
  return withUse;
}

const MLKIT_DEPENDENCIES = 'com.google.mlkit.vision.DEPENDENCIES';

/**
 * expo-camera déclare déjà `barcode_ui` : on fusionne les valeurs (liste séparée par des virgules)
 * et on remplace la déclaration de la bibliothèque (`tools:replace`).
 * @param {import('expo/config-plugins').AndroidConfig.Manifest.AndroidManifest} manifest
 */
function applyMlkitDependencies(manifest) {
  AndroidConfig.Manifest.ensureToolsAvailable(manifest);
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, MLKIT_DEPENDENCIES, 'barcode_ui,ocr');
  const item = (app['meta-data'] ?? []).find((m) => m.$['android:name'] === MLKIT_DEPENDENCIES);
  if (item) /** @type {Record<string, string>} */ (item.$)['tools:replace'] = 'android:value';
  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withAndroidRelease = (config) => {
  config = withAppBuildGradle(config, (c) => {
    c.modResults.contents = applySigning(c.modResults.contents);
    return c;
  });
  config = withAndroidManifest(config, (c) => {
    c.modResults = applyMlkitDependencies(c.modResults);
    return c;
  });
  return config;
};

module.exports = withAndroidRelease;
module.exports.applySigning = applySigning;
module.exports.applyMlkitDependencies = applyMlkitDependencies;
