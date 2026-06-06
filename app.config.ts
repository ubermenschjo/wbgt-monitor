import { ExpoConfig, ConfigContext } from 'expo/config';

type Flavor = 'biz' | 'consumer';

const FLAVOR: Flavor = (process.env.APP_FLAVOR as Flavor) === 'consumer' ? 'consumer' : 'biz';

const flavorConfig = {
  biz: {
    name: '熱中症レコーダー Pro',
    slug: 'wbgt-recorder-pro',
    bundleId: 'com.stagen.wbgt.biz',
  },
  consumer: {
    name: '熱中症アラート',
    slug: 'wbgt-alert',
    bundleId: 'com.stagen.wbgt.consumer',
  },
} as const;

const current = flavorConfig[FLAVOR];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: current.name,
  slug: current.slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: `./assets/${FLAVOR}/icon.png`,
  scheme: current.slug,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: `./assets/${FLAVOR}/splash.png`,
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: current.bundleId,
    infoPlist: {
      // バックグラウンドでの WBGT 監視（expo-background-fetch）に必要。
      UIBackgroundModes: ['fetch'],
    },
  },
  android: {
    package: current.bundleId,
    adaptiveIcon: {
      foregroundImage: `./assets/${FLAVOR}/icon.png`,
      backgroundColor: '#ffffff',
    },
  },
  plugins: [
    'expo-location',
    'expo-notifications',
    'expo-sqlite',
    '@react-native-community/datetimepicker',
  ],
  extra: {
    appFlavor: FLAVOR,
    eas: {
      projectId: '',
    },
  },
});
