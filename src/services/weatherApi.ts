/**
 * OpenMeteo 天気 API クライアント。
 *
 * 無料・API キー不要の OpenMeteo Forecast API から、WBGT 推定に必要な
 * 気象データ（気温・相対湿度・直達日射量・風速）を取得する。
 *
 * - 5 分間のメモリキャッシュで過剰なリクエストを防ぐ。
 * - 失敗時は指数バックオフで最大 3 回までリトライする。
 */

import { DEFAULT_SETTINGS } from '../utils/constants';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/** OpenMeteo の current_weather オブジェクト。 */
export interface OpenMeteoCurrentWeather {
  /** 気温（℃）。 */
  temperature: number;
  /** 風速（km/h）。 */
  windspeed: number;
  /** 風向（度）。 */
  winddirection: number;
  /** 天気コード（WMO）。 */
  weathercode: number;
  /** 昼夜フラグ（1=昼, 0=夜）。 */
  is_day: number;
  /** 観測時刻（ISO 8601）。 */
  time: string;
}

/** OpenMeteo の hourly オブジェクト。各配列は time と同じインデックスで対応する。 */
export interface OpenMeteoHourly {
  /** 時刻（ISO 8601）の配列。 */
  time: string[];
  /** 気温（℃）の配列。 */
  temperature_2m: number[];
  /** 相対湿度（%）の配列。 */
  relative_humidity_2m: number[];
  /** 直達日射量（W/m²）の配列。 */
  direct_radiation: number[];
  /** 風速（m/s）の配列。 */
  wind_speed_10m: number[];
}

/** OpenMeteo の daily オブジェクト。各配列は time（日付）と同じインデックスで対応する。 */
export interface OpenMeteoDaily {
  /** 日付（ISO 8601）の配列。 */
  time: string[];
  /** 日の出時刻（ISO 8601）の配列。 */
  sunrise: string[];
  /** 日の入り時刻（ISO 8601）の配列。 */
  sunset: string[];
}

/** OpenMeteo Forecast API のレスポンス全体。 */
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  /** タイムゾーン識別子。 */
  timezone: string;
  current_weather: OpenMeteoCurrentWeather;
  hourly: OpenMeteoHourly;
  /** 日次データ（日の出・日の入り）。 */
  daily: OpenMeteoDaily;
}

/** 緯度経度の組。 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface CacheEntry {
  data: OpenMeteoResponse;
  /** 取得時刻（epoch ミリ秒）。 */
  timestamp: number;
}

/** 座標ごとのレスポンスキャッシュ。 */
const cache = new Map<string, CacheEntry>();

/**
 * キャッシュキーを生成する。
 * 座標は小数 2 桁（約 1km 精度）に丸めて近傍リクエストを共有する。
 */
function buildCacheKey({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** OpenMeteo Forecast API のリクエスト URL を組み立てる。 */
function buildUrl({ latitude, longitude }: Coordinates): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'temperature_2m,relative_humidity_2m,direct_radiation,wind_speed_10m',
    daily: 'sunrise,sunset',
    current_weather: 'true',
    windspeed_unit: 'ms',
    // 48 時間（今日・明日）の予報を確実に含めるため 2 日分を要求する。
    forecast_days: '2',
    timezone: 'auto',
  });
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

/** 指定ミリ秒待機する。 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指定座標の天気データを取得する。
 *
 * キャッシュが有効（5 分以内）であればそれを返す。
 * 取得失敗時は指数バックオフで最大 3 回までリトライする。
 *
 * @param coords 取得対象の緯度経度
 * @param options.forceRefresh true の場合はキャッシュを無視して再取得する
 * @returns OpenMeteo のレスポンス
 * @throws すべてのリトライに失敗した場合
 */
export async function fetchWeather(
  coords: Coordinates,
  options: { forceRefresh?: boolean } = {},
): Promise<OpenMeteoResponse> {
  const key = buildCacheKey(coords);
  const now = Date.now();

  if (!options.forceRefresh) {
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < DEFAULT_SETTINGS.weatherCacheTtlMs) {
      return cached.data;
    }
  }

  const url = buildUrl(coords);
  let lastError: unknown;

  for (let attempt = 1; attempt <= DEFAULT_SETTINGS.maxRetryAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OpenMeteo API エラー: HTTP ${response.status}`);
      }
      const data = (await response.json()) as OpenMeteoResponse;
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < DEFAULT_SETTINGS.maxRetryAttempts) {
        // 指数バックオフ: 500ms, 1000ms, ...
        await delay(500 * 2 ** (attempt - 1));
      }
    }
  }

  throw new Error(
    `天気データの取得に失敗しました（${DEFAULT_SETTINGS.maxRetryAttempts} 回試行）: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

/** 天気データのキャッシュをすべて削除する（主にテスト用）。 */
export function clearWeatherCache(): void {
  cache.clear();
}
