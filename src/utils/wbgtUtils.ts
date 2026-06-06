/**
 * WBGT 関連のユーティリティ。
 */

import { type RiskLevel, WBGT_THRESHOLDS } from './constants';

/**
 * WBGT 値からリスクレベル（1〜5）を判定する。
 *
 * @param wbgt WBGT 値（℃）
 * @returns リスクレベル
 */
export function getRiskLevel(wbgt: number): RiskLevel {
  if (wbgt >= WBGT_THRESHOLDS[5]) return 5;
  if (wbgt >= WBGT_THRESHOLDS[4]) return 4;
  if (wbgt >= WBGT_THRESHOLDS[3]) return 3;
  if (wbgt >= WBGT_THRESHOLDS[2]) return 2;
  return 1;
}
