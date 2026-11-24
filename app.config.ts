import type { ExpoConfig } from 'expo/config';

/** Version publiée : dérivée du tag Git en CI (v0.2.0 → 0.2.0). */
const version = process.env.APP_VERSION ?? '0.1.0';
/** Doit augmenter à chaque build Android pour pouvoir installer par-dessus. */
const versionCode = Number(process.env.APP_VERSION_CODE ?? 1);

const config: ExpoConfig = {
  name: 'Gaspalli',
  slug: 'gaspalli',
  scheme: 'gaspalli',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'app.gaspalli',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: { NSCameraUsageDescription: 'Gaspalli utilise la caméra pour scanner tes produits et tickets.' },
  },
  android: {
    package: 'app.gaspalli',
    versionCode,
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
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
    'expo-apple-authentication',
    'expo-web-browser',
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#1F7A4D' }],
    [
      'expo-camera',
      {
        cameraPermission: 'Gaspalli utilise la caméra pour scanner tes produits et tickets.',
        microphonePermission: false,
        recordAudioAndroid: false,
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
