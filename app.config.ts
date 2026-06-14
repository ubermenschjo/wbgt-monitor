import { ExpoConfig, ConfigContext } from 'expo/config';

type Flavor = 'biz' | 'consumer';

const FLAVOR: Flavor = (process.env.APP_FLAVOR as Flavor) === 'consumer' ? 'consumer' : 'biz';

const flavorConfig = {
  biz: {
    name: '熱中症レコーダー Pro',
    slug: 'wbgt-recorder-pro',
    bundleId: 'com.stagen.wbgt.biz',
    projectId: '4bfbd112-ac0d-48ff-afdc-3f9caf48de9c',
  },
  consumer: {
    name: '熱中症アラート',
    slug: 'wbgt-alert',
    bundleId: 'com.stagen.wbgt.consumer',
    projectId: '20cff291-8c71-48d0-82f5-b436c0bea229',
  },
} as const;

const current = flavorConfig[FLAVOR];

const basePlugins: ExpoConfig['plugins'] = [
  [
    'expo-location',
    {
      locationWhenInUsePermission:
        '現在地の暑さ指数（WBGT）を算出するために位置情報を利用します。',
    },
  ],
  'expo-notifications',
  'expo-sqlite',
  'expo-font',
  '@react-native-community/datetimepicker',
  ...(FLAVOR === 'consumer' ? ['expo-tracking-transparency' as const] : []),
];

// consumer フレーバーのみ AdMob プラグインを有効化する。
const consumerAdMobPlugin: NonNullable<ExpoConfig['plugins']>[number] | null =
  FLAVOR === 'consumer'
    ? [
        'react-native-google-mobile-ads',
        {
          androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? '',
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? '',
        },
      ]
    : null;

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
    buildNumber: '1',
    infoPlist: {
      // バックグラウンドでの WBGT 監視（expo-background-fetch）に必要。
      UIBackgroundModes: ['fetch'],
      // ASO 用キーワード（梅雨シーズン対応）。
      CFBundleLocalizations: ['ja'],
      ...(FLAVOR === 'consumer'
        ? {
            NSUserTrackingUsageDescription:
              'より関連性の高い広告を表示するために、トラッキングの許可をお願いしています。拒否してもアプリの利用や広告表示には影響しません。',
          }
        : {}),
    },
  },
  android: {
    package: current.bundleId,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: `./assets/${FLAVOR}/adaptive-icon.png`,
      backgroundColor: '#ffffff',
    },
  },
  plugins: [
    ...basePlugins,
    ...(consumerAdMobPlugin ? [consumerAdMobPlugin] : []),
  ],
  extra: {
    appFlavor: FLAVOR,
    revenueCatIos: process.env.EXPO_PUBLIC_REVENUECAT_IOS ?? '',
    revenueCatAndroid: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID ?? '',
    admobAppOpenIos: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_IOS ?? '',
    admobAppOpenAndroid: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_ANDROID ?? '',
    eas: {
      projectId: current.projectId,
    },
  },
});
