import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Gaspalli',
  slug: 'gaspalli',
  scheme: 'gaspalli',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'app.gaspalli', supportsTablet: false },
  android: {
    package: 'app.gaspalli',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#1F7A4D' },
  },
  web: { bundler: 'metro', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
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
