import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Gaspalli',
  slug: 'gaspalli',
  scheme: 'gaspalli',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'app.gaspalli',
    supportsTablet: false,
    infoPlist: { NSCameraUsageDescription: 'Gaspalli utilise la caméra pour scanner tes produits et tickets.' },
  },
  android: {
    package: 'app.gaspalli',
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
