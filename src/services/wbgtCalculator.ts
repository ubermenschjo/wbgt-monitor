/**
 * WBGT（湿球黒球温度 / 暑さ指数）の推定エンジン。
 *
 * 気象データ（気温・湿度・日射量・風速）から屋外 WBGT を推定し、
 * 5 段階のリスクレベルに分類する。
 *
 * 注意:
 *   ここで用いる湿球温度・黒球温度はいずれも「推定値」である。
 *   厳密な WBGT は実測センサー（自然湿球・黒球温度計）でのみ得られる。
 */

import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_LABELS,
  RiskLevel,
  WBGT_THRESHOLDS,
} from '../utils/constants';

export type { RiskLevel } from '../utils/constants';

/**
 * WBGT 計算の入力となる気象パラメータ。
 */
export interface WeatherInput {
  /** 気温（℃）。 */
  temperature: number;
  /** 相対湿度（%）。 */
  relativeHumidity: number;
  /** 直達日射量（W/m²）。 */
  directRadiation: number;
  /** 風速（m/s）。 */
  windSpeed: number;
}

/**
 * 計算済みの WBGT データ。
 */
export interface WbgtData {
  /** 推定 WBGT 値（℃）。 */
  wbgt: number;
  /** リスクレベル（1〜5）。 */
  riskLevel: RiskLevel;
  /** リスクレベルの日本語ラベル。 */
  riskLabel: string;
  /** リスクレベルの表示色（HEX）。 */
  riskColor: string;
  /** 推定湿球温度（℃）。 */
  wetBulbTemperature: number;
  /** 推定黒球温度（℃）。 */
  globeTemperature: number;
  /** 入力に使用した気温（℃）。 */
  airTemperature: number;
}

/**
 * 1 時間ごとの予報データ。
 */
export interface HourlyForecast extends WbgtData {
  /** 予報時刻（ISO 8601 文字列）。 */
  time: string;
}

/** 黒球温度推定の経験係数。日射による昇温の強さを表す。 */
const GLOBE_SOLAR_COEFFICIENT = 0.0146;
/** 黒球温度推定で用いる最低風速（m/s）。自然対流の下限を考慮。 */
const GLOBE_MIN_WIND_SPEED = 0.5;
/** 黒球温度の気温からの上昇幅の上限（℃）。非現実的な値を抑える。 */
const GLOBE_MAX_RISE = 25;

/**
 * Stull (2011) の式で湿球温度（℃）を推定する。
 *
 * 参考: R. Stull, "Wet-Bulb Temperature from Relative Humidity and Air
 * Temperature", Journal of Applied Meteorology and Climatology, 2011.
 *
 * 適用範囲は概ね気温 -20〜50℃、湿度 5〜99% で精度が高い。
 *
 * @param temperature 気温（℃）
 * @param relativeHumidity 相対湿度（%, 0〜100）
 * @returns 推定湿球温度（℃）
 */
export function calculateWetBulb(temperature: number, relativeHumidity: number): number {
  const t = temperature;
  const rh = clamp(relativeHumidity, 0, 100);

  return (
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/**
 * 黒球温度（℃）を経験式で推定する。
 *
 * 黒球は日射を吸収して昇温し、風による対流で冷却される。
 * 定常状態の熱収支を単純化し、気温からの上昇幅を
 *   ΔTg = C * S / v^0.6
 * で近似する（S: 日射量, v: 風速, C: 経験係数）。
 *
 * これは簡易近似であり、厳密な黒球温度は反復計算
 * （Liljegren モデル等）を要する点に留意。
 *
 * @param temperature 気温（℃）
 * @param directRadiation 直達日射量（W/m²）
 * @param windSpeed 風速（m/s）
 * @returns 推定黒球温度（℃）
 */
export function calculateGlobeTemperature(
  temperature: number,
  directRadiation: number,
  windSpeed: number,
): number {
  const radiation = Math.max(directRadiation, 0);
  const effectiveWind = Math.max(windSpeed, GLOBE_MIN_WIND_SPEED);
  const rise = Math.min(
    (GLOBE_SOLAR_COEFFICIENT * radiation) / Math.pow(effectiveWind, 0.6),
    GLOBE_MAX_RISE,
  );
  return temperature + rise;
}

/**
 * 屋外（日射あり）の WBGT を推定する。
 *
 * 標準式: WBGT = 0.7 * Tw + 0.2 * Tg + 0.1 * Ta
 *   Tw: 湿球温度, Tg: 黒球温度, Ta: 気温
 *
 * @param input 気象パラメータ
 * @returns WBGT データ（リスクレベル・色などを含む）
 */
export function calculateWbgt(input: WeatherInput): WbgtData {
  const { temperature, relativeHumidity, directRadiation, windSpeed } = input;

  const wetBulb = calculateWetBulb(temperature, relativeHumidity);
  const globe = calculateGlobeTemperature(temperature, directRadiation, windSpeed);
  const wbgt = roundTo(0.7 * wetBulb + 0.2 * globe + 0.1 * temperature, 1);

  const riskLevel = classifyRiskLevel(wbgt);

  return {
    wbgt,
    riskLevel,
    riskLabel: RISK_LEVEL_LABELS[riskLevel],
    riskColor: RISK_LEVEL_COLORS[riskLevel],
    wetBulbTemperature: roundTo(wetBulb, 1),
    globeTemperature: roundTo(globe, 1),
    airTemperature: temperature,
  };
}

/**
 * WBGT 値を 5 段階のリスクレベルに分類する。
 *
 * @param wbgt WBGT 値（℃）
 * @returns リスクレベル（1〜5）
 */
export function classifyRiskLevel(wbgt: number): RiskLevel {
  if (wbgt >= WBGT_THRESHOLDS[5]) return 5;
  if (wbgt >= WBGT_THRESHOLDS[4]) return 4;
  if (wbgt >= WBGT_THRESHOLDS[3]) return 3;
  if (wbgt >= WBGT_THRESHOLDS[2]) return 2;
  return 1;
}

/** 値を [min, max] の範囲に収める。 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 指定した小数桁数に四捨五入する。 */
function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
