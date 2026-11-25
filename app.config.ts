import type { ExpoConfig } from 'expo/config';

/** Version publiée : dérivée du tag Git en CI (v0.2.0 → 0.2.0). */
const version = process.env.APP_VERSION ?? '0.1.0';
/** Doit augmenter à chaque build Android pour pouvoir installer par-dessus. */
const versionCode = Number(process.env.APP_VERSION_CODE ?? 1);

/**
 * Variante : seul le profil EAS « development » (client de développement) a un identifiant à part,
 * pour cohabiter avec l'app installée. Les builds de test et de production gardent `app.gaspalli`
 * (sinon on ne pourrait plus installer par-dessus les versions déjà distribuées).
 */
const isDevClient = process.env.APP_ENV === 'development';
const appId = isDevClient ? 'app.gaspalli.dev' : 'app.gaspalli';

const config: ExpoConfig = {
  name: isDevClient ? 'Gaspalli (dev)' : 'Gaspalli',
  slug: 'gaspalli',
  scheme: 'gaspalli',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: appId,
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription: 'Gaspalli utilise la caméra pour scanner tes produits et tickets.',
      NSPhotoLibraryUsageDescription: 'Gaspalli accède à tes photos pour ajouter une photo de recette ou de ticket de caisse.',
    },
  },
  android: {
    package: appId,
    versionCode,
    // Minuteurs du mode cuisine dans l'horloge du téléphone.
    permissions: ['com.android.alarm.permission.SET_ALARM'],
    // Rien de plus que nécessaire (exigence des stores) : le sélecteur de photos et de fichiers
    // d'Android ne demande aucun accès au stockage ; la superposition ne sert qu'au débogage.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { bundler: 'metro', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    './plugins/withAndroidRelease',
    './plugins/withShareIntent',
    'expo-apple-authentication',
    'expo-web-browser',
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#1F7A4D' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Gaspalli accède à tes photos pour ajouter une photo de recette ou de ticket de caisse.',
        cameraPermission: 'Gaspalli utilise la caméra pour scanner tes produits et tickets.',
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Gaspalli utilise la caméra pour scanner tes produits et tickets.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        // Envoi des « source maps » seulement si la CI a un jeton Sentry (sinon : build normal).
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#F3F6F1',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0F1613' },
      },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
