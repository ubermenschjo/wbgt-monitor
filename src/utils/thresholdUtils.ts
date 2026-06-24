import type { UserProfile } from '../services/database';

/** 設定しきい値に個人プロフィール補正を加えた有効値。 */
export function getEffectiveThreshold(
  baseThreshold: number,
  profile: Pick<UserProfile, 'ageGroup' | 'healthCondition'>,
): number {
  let modifier = 0;

  if (profile.ageGroup === 'child') {
    modifier += 2;
  } else if (profile.ageGroup === 'elderly') {
    modifier -= 2;
  }

  if (profile.healthCondition === 'other') {
    modifier -= 1;
  }

  return baseThreshold + modifier;
}
