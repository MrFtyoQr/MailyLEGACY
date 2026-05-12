import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MailyT-Cuida',
  slug: 'mailytcuida',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'mailytcuida',
  userInterfaceStyle: 'light',

  icon: './assets/images/icon.png',

  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0F1E',
  },

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.mailyt.cuida',
    buildNumber: '1',
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0A0F1E',
    },
    package: 'com.mailyt.cuida',
    versionCode: 1,
  },

  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/icon.png',
  },

  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0A0F1E',
        image: './assets/images/splash.png',
        imageWidth: 300,
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'mailyt',
        project: 'mailytcuida-mobile',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
})
