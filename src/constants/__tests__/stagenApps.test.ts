import { Platform } from 'react-native';

import { STAGEN_APPS, getStagenAppStoreUrl } from '../stagenApps';

describe('stagenApps', () => {
  it('全アプリにストアURLとbundleIdがある', () => {
    for (const app of Object.values(STAGEN_APPS)) {
      expect(app.appStoreId).toMatch(/^\d+$/);
      expect(app.ios).toContain(app.appStoreId);
      expect(app.android).toContain(app.bundleId);
    }
  });

  it('iOSはApp Store URLを返す', () => {
    Platform.OS = 'ios';
    expect(getStagenAppStoreUrl('wbgt-biz')).toBe(
      'https://apps.apple.com/app/id6780710276',
    );
  });

  it('AndroidはPlay Store URLを返す', () => {
    Platform.OS = 'android';
    expect(getStagenAppStoreUrl('zeical')).toBe(
      'https://play.google.com/store/apps/details?id=com.stagen.zeical',
    );
  });
});
