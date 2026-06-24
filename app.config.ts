import { ExpoConfig, ConfigContext } from 'expo/config';

import flavorVersions from './versions.json';

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
    name: 'WBGT アラート',
    slug: 'wbgt-alert',
    bundleId: 'com.stagen.wbgt.consumer',
    projectId: '20cff291-8c71-48d0-82f5-b436c0bea229',
  },
} as const;

const current = flavorConfig[FLAVOR];

/** EAS Update のエンドポイント（フレーバーごとに別 EAS プロジェクト）。 */
const updatesUrl = `https://u.expo.dev/${current.projectId}`;

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

// package.json に依存があるため全フレーバーで autolink される。
// APPLICATION_ID 未設定だと起動時にクラッシュするため、App ID のみ設定する（広告表示は consumer のみ）。
const adMobPlugin: NonNullable<ExpoConfig['plugins']>[number] = [
  'react-native-google-mobile-ads',
  {
    androidAppId: process.env.ADMOB_ANDROID_APP_ID ?? '',
    iosAppId: process.env.ADMOB_IOS_APP_ID ?? '',
  },
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: current.name,
  slug: current.slug,
  version: flavorVersions[FLAVOR],
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: updatesUrl,
  },
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
      ITSAppUsesNonExemptEncryption: false,
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
    adaptiveIcon: {
      foregroundImage: `./assets/${FLAVOR}/adaptive-icon.png`,
      backgroundColor: '#ffffff',
    },
  },
  plugins: [
    './plugins/withLocalNotificationsOnly.js',
    ...basePlugins,
    adMobPlugin,
    ...(FLAVOR === 'consumer'
      ? ([
          [
            '@bittingz/expo-widgets',
            {
              ios: {
                src: './widgets/ios',
                devTeamId: process.env.APPLE_TEAM_ID ?? 'V8R9XYRK99',
                mode: 'production',
                moduleDependencies: ['WidgetSnapshotData.swift'],
                useLiveActivities: true,
                frequentUpdates: true,
              },
              android: {
                src: './widgets/android/src',
                widgets: [
                  {
                    name: 'WbgtWidget',
                    resourceName: '@xml/wbgt_widget_info',
                  },
                ],
                distPlaceholder: 'com.stagen.wbgt.consumer',
              },
            },
          ],
        ] as NonNullable<ExpoConfig['plugins']>)
      : []),
  ],
  extra: {
    appFlavor: FLAVOR,
    revenueCatIos: process.env.REVENUECAT_IOS ?? '',
    revenueCatAndroid: process.env.REVENUECAT_ANDROID ?? '',
    admobAppOpenIos: process.env.ADMOB_APP_OPEN_IOS ?? '',
    admobAppOpenAndroid: process.env.ADMOB_APP_OPEN_ANDROID ?? '',
    eas: {
      projectId: current.projectId,
    },
  },
});
