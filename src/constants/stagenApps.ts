import { Platform } from 'react-native';

export type StagenAppId = 'rakubill' | 'zeical' | 'wbgt-consumer' | 'wbgt-biz';

/** App Store Connect の Apple ID（2026-06-24 時点） */
export const STAGEN_APPS: Record<
  StagenAppId,
  { nameJa: string; appStoreId: string; bundleId: string; ios: string; android: string }
> = {
  rakubill: {
    nameJa: 'ラクビル',
    appStoreId: '6780785397',
    bundleId: 'com.stagen.rakubill',
    ios: 'https://apps.apple.com/app/id6780785397',
    android: 'https://play.google.com/store/apps/details?id=com.stagen.rakubill',
  },
  zeical: {
    nameJa: 'ZeiCal - 税務カレンダー',
    appStoreId: '6780321349',
    bundleId: 'com.stagen.zeical',
    ios: 'https://apps.apple.com/app/id6780321349',
    android: 'https://play.google.com/store/apps/details?id=com.stagen.zeical',
  },
  'wbgt-consumer': {
    nameJa: 'WBGT アラート',
    appStoreId: '6780366425',
    bundleId: 'com.stagen.wbgt.consumer',
    ios: 'https://apps.apple.com/app/id6780366425',
    android: 'https://play.google.com/store/apps/details?id=com.stagen.wbgt.consumer',
  },
  'wbgt-biz': {
    nameJa: '熱中症レコーダー Pro',
    appStoreId: '6780710276',
    bundleId: 'com.stagen.wbgt.biz',
    ios: 'https://apps.apple.com/app/id6780710276',
    android: 'https://play.google.com/store/apps/details?id=com.stagen.wbgt.biz',
  },
};

export function getStagenAppStoreUrl(appId: StagenAppId): string {
  const app = STAGEN_APPS[appId];
  return Platform.OS === 'ios' ? app.ios : app.android;
}
