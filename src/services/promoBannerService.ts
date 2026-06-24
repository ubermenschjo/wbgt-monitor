/**
 * コンテキストバナーの表示頻度（7日に1回）とタップ計測。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StagenAppId } from '../constants/stagenApps';
import { getAllSettings, saveSetting } from './database';

const BANNER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_SHOWN_PREFIX = 'banner_shown_';

function lastShownKey(target: StagenAppId): string {
  return `${LAST_SHOWN_PREFIX}${target}`;
}

function tapCountKey(target: StagenAppId): string {
  return `banner_tap_${target.replace(/-/g, '_')}`;
}

/** コンテキストバナーを表示してよいか（7日に1回まで）。 */
export async function shouldShowContextBanner(target: StagenAppId): Promise<boolean> {
  const raw = await AsyncStorage.getItem(lastShownKey(target));
  if (!raw) return true;
  const lastShown = Number(raw);
  if (!Number.isFinite(lastShown)) return true;
  return Date.now() - lastShown >= BANNER_COOLDOWN_MS;
}

/** コンテキストバナーを表示したことを記録する。 */
export async function markContextBannerShown(target: StagenAppId): Promise<void> {
  await AsyncStorage.setItem(lastShownKey(target), String(Date.now()));
}

/** バナータップをローカルに累計する。 */
export async function recordBannerTap(target: StagenAppId): Promise<void> {
  const key = tapCountKey(target);
  const rows = await getAllSettings();
  const current = Number(rows[key] ?? '0');
  const next = Number.isFinite(current) ? current + 1 : 1;
  await saveSetting(key, String(next));
}
