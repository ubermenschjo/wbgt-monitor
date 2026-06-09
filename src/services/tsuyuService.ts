/**
 * 梅雨モード判定サービス。
 *
 * 外気の湿度データから室内推定湿度・カビ発生リスク・換気推奨タイミングを算出する。
 * 梅雨シーズン（6〜7 月）に自動有効化される。
 *
 * 新規 API は不要 — 既存の OpenMeteo hourly.relative_humidity_2m を活用する。
 */

import { HourlyForecast } from './wbgtCalculator';
import { OpenMeteoResponse } from './weatherApi';

// ────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────

/** 梅雨モードが自動有効化される月（1-indexed）。 */
const TSUYU_MONTHS = [6, 7] as const;

/** 室内湿度の補正値（℃）。密閉空間で +5〜8% 程度高くなる傾向。 */
const INDOOR_HUMIDITY_OFFSET = 5;

/** カビ発生リスクのしきい値（室内推定湿度 %）。 */
export const MOLD_RISK_THRESHOLDS = {
  /** 高リスク: 室内推定 80% 以上 */
  high: 80,
  /** 中リスク: 室内推定 70% 以上 */
  moderate: 70,
  /** 低リスク: 70% 未満 */
  low: 0,
} as const;

/** 室内湿度アラート通知のしきい値（%）。 */
export const HUMIDITY_ALERT_THRESHOLD = 70;

/** 換気推奨の判定: 外気湿度がこの値以下なら換気が有効。 */
const VENTILATION_HUMIDITY_THRESHOLD = 65;

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

/** カビ発生リスクレベル。 */
export type MoldRiskLevel = 'low' | 'moderate' | 'high';

/** カビリスクの表示情報。 */
export interface MoldRiskInfo {
  level: MoldRiskLevel;
  label: string;
  emoji: string;
  color: string;
}

/** 換気推奨タイミング。 */
export interface VentilationWindow {
  /** 開始時刻（ISO 8601）。 */
  startTime: string;
  /** 終了時刻（ISO 8601）。 */
  endTime: string;
  /** その時間帯の平均外気湿度（%）。 */
  avgHumidity: number;
}

/** 梅雨モードの総合判定結果。 */
export interface TsuyuStatus {
  /** 梅雨モードが有効か。 */
  isActive: boolean;
  /** 現在の外気湿度（%）。 */
  outdoorHumidity: number;
  /** 推定室内湿度（%）。 */
  indoorHumidity: number;
  /** カビ発生リスク。 */
  moldRisk: MoldRiskInfo;
  /** 換気推奨タイミング（最大 3 枠）。 */
  ventilationWindows: VentilationWindow[];
  /** 梅雨モード用のワンライン概要。 */
  summary: string;
}

// ────────────────────────────────────────────
// リスク判定
// ────────────────────────────────────────────

/** カビリスクレベルごとの表示情報。 */
const MOLD_RISK_MAP: Record<MoldRiskLevel, Omit<MoldRiskInfo, 'level'>> = {
  high: { label: 'カビ発生リスク：高', emoji: '🔴', color: '#F44336' },
  moderate: { label: 'カビ発生リスク：中', emoji: '🟠', color: '#FF9800' },
  low: { label: 'カビ発生リスク：低', emoji: '🟢', color: '#4CAF50' },
};

/** biz フレーバー用のラベル。 */
const MOLD_RISK_MAP_BIZ: Record<MoldRiskLevel, Omit<MoldRiskInfo, 'level'>> = {
  high: { label: '湿度管理：要対策', emoji: '🔴', color: '#F44336' },
  moderate: { label: '湿度管理：注意', emoji: '🟠', color: '#FF9800' },
  low: { label: '湿度管理：良好', emoji: '🟢', color: '#4CAF50' },
};

/**
 * 室内推定湿度からカビ発生リスクを判定する。
 *
 * @param indoorHumidity 推定室内湿度（%）
 * @param flavor フレーバー（biz / consumer）
 */
export function classifyMoldRisk(
  indoorHumidity: number,
  flavor: 'biz' | 'consumer' = 'consumer',
): MoldRiskInfo {
  const map = flavor === 'biz' ? MOLD_RISK_MAP_BIZ : MOLD_RISK_MAP;

  if (indoorHumidity >= MOLD_RISK_THRESHOLDS.high) {
    return { level: 'high', ...map.high };
  }
  if (indoorHumidity >= MOLD_RISK_THRESHOLDS.moderate) {
    return { level: 'moderate', ...map.moderate };
  }
  return { level: 'low', ...map.low };
}

// ────────────────────────────────────────────
// 換気タイミング
// ────────────────────────────────────────────

/**
 * 予報データから換気推奨タイミングを特定する。
 *
 * 外気湿度がしきい値以下に下がる連続時間帯をウィンドウとして抽出し、
 * 湿度が低い順に最大 3 枠を返す。
 *
 * @param hourlyData OpenMeteo の hourly データ
 * @returns 換気推奨ウィンドウ（最大 3 件）
 */
export function findVentilationWindows(
  hourlyData: { time: string[]; relative_humidity_2m: number[] },
): VentilationWindow[] {
  const windows: VentilationWindow[] = [];
  let windowStart: number | null = null;
  let humiditySum = 0;
  let count = 0;

  // 現在時刻以降のデータのみ対象にする。
  const now = Date.now();
  const startIdx = hourlyData.time.findIndex(
    (t) => new Date(t).getTime() >= now,
  );
  if (startIdx < 0) return [];

  // 24 時間先まで（最大 24 エントリ）。
  const endIdx = Math.min(startIdx + 24, hourlyData.time.length);

  for (let i = startIdx; i < endIdx; i++) {
    const humidity = hourlyData.relative_humidity_2m[i];

    if (humidity <= VENTILATION_HUMIDITY_THRESHOLD) {
      if (windowStart === null) {
        windowStart = i;
        humiditySum = 0;
        count = 0;
      }
      humiditySum += humidity;
      count++;
    } else {
      if (windowStart !== null && count >= 2) {
        windows.push({
          startTime: hourlyData.time[windowStart],
          endTime: hourlyData.time[i - 1],
          avgHumidity: Math.round(humiditySum / count),
        });
      }
      windowStart = null;
    }
  }

  // 末尾でウィンドウが閉じていない場合。
  if (windowStart !== null && count >= 2) {
    windows.push({
      startTime: hourlyData.time[windowStart],
      endTime: hourlyData.time[endIdx - 1],
      avgHumidity: Math.round(humiditySum / count),
    });
  }

  // 湿度が低い順にソートし最大 3 件返す。
  return windows
    .sort((a, b) => a.avgHumidity - b.avgHumidity)
    .slice(0, 3);
}

// ────────────────────────────────────────────
// メイン判定
// ────────────────────────────────────────────

/**
 * 現在の月が梅雨シーズン（6〜7 月）か判定する。
 *
 * @param date 判定日（省略時は現在日時）
 */
export function isTsuyuSeason(date?: Date): boolean {
  const month = (date ?? new Date()).getMonth() + 1;
  return (TSUYU_MONTHS as readonly number[]).includes(month);
}

/**
 * 外気湿度から室内推定湿度を算出する。
 *
 * 密閉空間は生活排湿（炊事・呼吸・入浴）で外気比 5% 程度高くなる傾向。
 * 除湿機使用時の補正は将来のセンサー連動（v1.2）で対応予定。
 *
 * @param outdoorHumidity 外気の相対湿度（%）
 * @returns 推定室内湿度（%, 上限 100）
 */
export function estimateIndoorHumidity(outdoorHumidity: number): number {
  return Math.min(outdoorHumidity + INDOOR_HUMIDITY_OFFSET, 100);
}

/**
 * OpenMeteo レスポンスから梅雨モードの総合判定を行う。
 *
 * @param response OpenMeteo の生レスポンス
 * @param flavor フレーバー（biz / consumer）
 * @returns 梅雨モードの判定結果
 */
export function evaluateTsuyuStatus(
  response: OpenMeteoResponse,
  flavor: 'biz' | 'consumer' = 'consumer',
): TsuyuStatus {
  const active = isTsuyuSeason();

  // 梅雨シーズン外なら早期リターン。
  if (!active) {
    return {
      isActive: false,
      outdoorHumidity: 0,
      indoorHumidity: 0,
      moldRisk: { level: 'low', ...MOLD_RISK_MAP.low },
      ventilationWindows: [],
      summary: '',
    };
  }

  // 現在時刻に最も近い hourly インデックスを探す。
  const now = Date.now();
  const { hourly } = response;
  let currentIdx = hourly.time.findIndex(
    (t) => new Date(t).getTime() >= now,
  );
  if (currentIdx < 0) currentIdx = hourly.time.length - 1;
  // ひとつ前のほうが「実績」に近い場合は調整。
  if (currentIdx > 0) {
    const prev = new Date(hourly.time[currentIdx - 1]).getTime();
    const curr = new Date(hourly.time[currentIdx]).getTime();
    if (now - prev < curr - now) currentIdx--;
  }

  const outdoorHumidity = hourly.relative_humidity_2m[currentIdx] ?? 0;
  const indoorHumidity = estimateIndoorHumidity(outdoorHumidity);
  const moldRisk = classifyMoldRisk(indoorHumidity, flavor);
  const ventilationWindows = findVentilationWindows(hourly);

  // ワンライン概要を構築。
  let summary: string;
  if (moldRisk.level === 'high') {
    summary = `${moldRisk.emoji} 室内湿度 ${indoorHumidity}% — カビ・ダニ注意！`;
  } else if (moldRisk.level === 'moderate') {
    summary = `${moldRisk.emoji} 室内湿度 ${indoorHumidity}% — 換気推奨`;
  } else {
    summary = `${moldRisk.emoji} 室内湿度 ${indoorHumidity}% — 良好`;
  }

  if (ventilationWindows.length > 0) {
    const best = ventilationWindows[0];
    const startHour = new Date(best.startTime).getHours();
    const endHour = new Date(best.endTime).getHours() + 1;
    summary += ` ｜ 換気チャンス ${startHour}〜${endHour}時`;
  }

  return {
    isActive: true,
    outdoorHumidity,
    indoorHumidity,
    moldRisk,
    ventilationWindows,
    summary,
  };
}
