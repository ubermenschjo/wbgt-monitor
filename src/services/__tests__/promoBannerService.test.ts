import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  markContextBannerShown,
  recordBannerTap,
  shouldShowContextBanner,
} from '../promoBannerService';
import { getAllSettings, saveSetting } from '../database';

jest.mock('../database', () => ({
  getAllSettings: jest.fn(),
  saveSetting: jest.fn(),
}));

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (getAllSettings as jest.Mock).mockResolvedValue({});
  (saveSetting as jest.Mock).mockResolvedValue(undefined);
});

describe('promoBannerService', () => {
  it('初回はコンテキストバナーを表示できる', async () => {
    expect(await shouldShowContextBanner('wbgt-biz')).toBe(true);
  });

  it('表示直後は7日間再表示しない', async () => {
    await markContextBannerShown('wbgt-biz');
    expect(await shouldShowContextBanner('wbgt-biz')).toBe(false);
  });

  it('7日経過後は再表示できる', async () => {
    const eightDaysAgo = Date.now() - SEVEN_DAYS_MS - 60_000;
    await AsyncStorage.setItem('banner_shown_wbgt-biz', String(eightDaysAgo));
    expect(await shouldShowContextBanner('wbgt-biz')).toBe(true);
  });

  it('タップ回数をSQLite settingsに累計する', async () => {
    (getAllSettings as jest.Mock).mockResolvedValueOnce({ banner_tap_wbgt_biz: '2' });
    await recordBannerTap('wbgt-biz');
    expect(saveSetting).toHaveBeenCalledWith('banner_tap_wbgt_biz', '3');
  });
});
