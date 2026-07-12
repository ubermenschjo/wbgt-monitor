/**
 * Google Play 審査用の一時アクセス（biz flavor）。
 * 購読なしで有料機能を確認できる隠しコード。一般ユーザー向け UI は出さない。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'review_access_enabled';
export const REVIEW_ACCESS_CODE = 'PLAY_REVIEW';

export async function isReviewAccessEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value === '1';
}

export async function tryEnableReviewAccess(code: string): Promise<boolean> {
  if (code.trim() !== REVIEW_ACCESS_CODE) return false;
  await AsyncStorage.setItem(STORAGE_KEY, '1');
  return true;
}
