// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applySigning, applyMlkitDependencies } = require('../plugins/withAndroidRelease') as {
  applySigning: (g: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyMlkitDependencies: (m: any) => any;
};

const GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`;

describe('plugin withAndroidRelease', () => {
  const out = applySigning(GRADLE);
  it('ajoute une config release lisant les variables d’environnement', () => {
    expect(out).toContain("System.getenv('GASPALLI_UPLOAD_STORE_FILE')");
  });
  it('signe le build release avec la config release, laisse debug intact', () => {
    const buildTypes = out.slice(out.indexOf('buildTypes {'));
    expect(buildTypes.match(/signingConfig signingConfigs\.release/g)).toHaveLength(1);
    expect(buildTypes.indexOf('signingConfigs.debug')).toBeLessThan(buildTypes.indexOf('release {'));
  });
  it('est idempotent', () => {
    expect(applySigning(out)).toBe(out);
  });
});

describe('métadonnées ML Kit', () => {
  it('fusionne avec barcode_ui (expo-camera) et remplace la valeur de la bibliothèque', () => {
    const manifest = { manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }] } };
    const out = applyMlkitDependencies(manifest);
    expect(out.manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(out.manifest.application[0]['meta-data']).toEqual([
      { $: { 'android:name': 'com.google.mlkit.vision.DEPENDENCIES', 'android:value': 'barcode_ui,ocr', 'tools:replace': 'android:value' } },
    ]);
  });
});
