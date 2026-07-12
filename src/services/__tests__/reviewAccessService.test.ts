import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isReviewAccessEnabled,
  REVIEW_ACCESS_CODE,
  tryEnableReviewAccess,
} from '../reviewAccessService';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('reviewAccessService', () => {
  it('accepts PLAY_REVIEW and persists', async () => {
    expect(await tryEnableReviewAccess(REVIEW_ACCESS_CODE)).toBe(true);
    expect(await isReviewAccessEnabled()).toBe(true);
  });

  it('rejects wrong code', async () => {
    expect(await tryEnableReviewAccess('wrong')).toBe(false);
    expect(await isReviewAccessEnabled()).toBe(false);
  });
});
