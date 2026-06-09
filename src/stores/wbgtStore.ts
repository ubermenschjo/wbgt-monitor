/**
 * WBGT 状態管理ストア（zustand）。
 *
 * 現在の WBGT・リスクレベル・現在地・24 時間予報・読み込み/エラー状態を保持し、
 * 位置情報の更新と天気データの取得アクションを提供する。
 * 10 分ごとの自動更新にも対応する。
 */

import { create } from 'zustand';

import {
  HourlyForecast,
  WbgtData,
  calculateWbgt,
} from '../services/wbgtCalculator';
import {
  getCurrentLocation,
  type LocationInfo,
} from '../services/locationService';
import {
  fetchWeather,
  type OpenMeteoResponse,
} from '../services/weatherApi';
import {
  fetchEnvMinistryWbgt,
  type EnvMinistryWbgt,
} from '../services/envMinistryApi';
import {
  evaluateTsuyuStatus,
  type TsuyuStatus,
} from '../services/tsuyuService';
import { getFlavor } from '../hooks/useLabel';
import { notifyWbgtThreshold, notifyHumidity } from '../services/notificationService';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../utils/constants';

/** 現在地（座標と地名）。 */
export interface StoreLocation {
  latitude: number;
  longitude: number;
  placeName: string | null;
}

/** 日の出・日の入りイベント（グラフのマーカー用）。 */
export interface SunEvent {
  /** イベント時刻（ISO 8601）。 */
  time: string;
  /** 種別。 */
  type: 'sunrise' | 'sunset';
}

/** ストアの状態。 */
interface WbgtState {
  /** 現在の WBGT データ。未取得時は null。 */
  current: WbgtData | null;
  /** 現在地。未取得時は null。 */
  location: StoreLocation | null;
  /** 今日・明日（48 時間）の予報。 */
  hourlyForecast: HourlyForecast[];
  /** 予報期間内の日の出・日の入りイベント。 */
  sunEvents: SunEvent[];
  /** 環境省由来の WBGT。取得できた場合のみ設定される。 */
  envMinistryWbgt: EnvMinistryWbgt | null;
  /** 梅雨モードの判定結果。シーズン外なら isActive=false。 */
  tsuyuStatus: TsuyuStatus | null;
  /** 読み込み中フラグ。 */
  isLoading: boolean;
  /** エラーメッセージ。エラーが無ければ null。 */
  error: string | null;
  /** 最終更新時刻（epoch ミリ秒）。未更新時は null。 */
  lastUpdated: number | null;

  /** 現在地の天気を取得して WBGT を再計算する。 */
  fetchWbgt: () => Promise<void>;
  /** 位置情報を再取得し、続けて天気を更新する。 */
  refreshLocation: () => Promise<void>;
  /** 10 分間隔の自動更新を開始する。停止用の関数を返す。 */
  startAutoRefresh: () => () => void;
}

/**
 * OpenMeteo レスポンスから「現在時刻に対応する hourly 配列のインデックス」を求める。
 * current_weather.time と一致する要素を優先し、無ければ最初の要素にフォールバックする。
 */
function findCurrentHourIndex(response: OpenMeteoResponse): number {
  const { time } = response.hourly;
  const currentTime = response.current_weather.time;
  const exact = time.indexOf(currentTime);
  if (exact >= 0) return exact;

  // 一致しない場合は現在時刻以降の最初の要素を探す。
  const now = Date.now();
  const upcoming = time.findIndex((t) => new Date(t).getTime() >= now);
  return upcoming >= 0 ? upcoming : 0;
}

/** OpenMeteo レスポンスから現在の WBGT データを構築する。 */
function buildCurrentWbgt(response: OpenMeteoResponse): WbgtData {
  const index = findCurrentHourIndex(response);
  const { hourly, current_weather } = response;

  return calculateWbgt({
    // 気温・風速はより新しい current_weather を優先する。
    temperature: current_weather.temperature,
    windSpeed: current_weather.windspeed,
    // 湿度・日射量は current_weather に含まれないため hourly から補う。
    relativeHumidity: hourly.relative_humidity_2m[index] ?? 0,
    directRadiation: hourly.direct_radiation[index] ?? 0,
  });
}

/** OpenMeteo レスポンスから次の 24 時間分の予報を構築する。 */
function buildHourlyForecast(response: OpenMeteoResponse): HourlyForecast[] {
  const startIndex = findCurrentHourIndex(response);
  const { hourly } = response;
  const endIndex = Math.min(
    startIndex + DEFAULT_SETTINGS.forecastHours,
    hourly.time.length,
  );

  const forecast: HourlyForecast[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    const wbgt = calculateWbgt({
      temperature: hourly.temperature_2m[i],
      relativeHumidity: hourly.relative_humidity_2m[i],
      directRadiation: hourly.direct_radiation[i],
      windSpeed: hourly.wind_speed_10m[i],
    });
    forecast.push({ time: hourly.time[i], ...wbgt });
  }
  return forecast;
}

/**
 * OpenMeteo の daily データから、予報期間に含まれる日の出・日の入りを抽出する。
 * 予報配列の時間範囲（先頭〜末尾）に収まるイベントのみ返す。
 */
function buildSunEvents(
  response: OpenMeteoResponse,
  forecast: HourlyForecast[],
): SunEvent[] {
  const { daily } = response;
  if (!daily || forecast.length === 0) return [];

  const start = new Date(forecast[0].time).getTime();
  const end = new Date(forecast[forecast.length - 1].time).getTime();

  const events: SunEvent[] = [];
  const collect = (times: string[] | undefined, type: SunEvent['type']) => {
    for (const t of times ?? []) {
      const ts = new Date(t).getTime();
      if (ts >= start && ts <= end) events.push({ time: t, type });
    }
  };
  collect(daily.sunrise, 'sunrise');
  collect(daily.sunset, 'sunset');
  return events;
}

/**
 * 自動更新タイマー。
 * state には保持せず、モジュールスコープで管理する（多重起動を防ぐ）。
 */
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

/** 自動更新を停止する。 */
function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

/**
 * 取得した WBGT を設定しきい値と照合し、超過していれば通知する。
 * 通知が無効な場合・レート制限中は何もしない。
 */
async function checkThresholdAndNotify(
  wbgt: number,
  place: string | null,
): Promise<void> {
  const settings = useSettingsStore.getState();
  if (!settings.notificationEnabled) return;
  if (wbgt < settings.wbgtThreshold) return;
  await notifyWbgtThreshold(wbgt, place);
}

export const useWbgtStore = create<WbgtState>((set, get) => ({
  current: null,
  location: null,
  hourlyForecast: [],
  sunEvents: [],
  envMinistryWbgt: null,
  tsuyuStatus: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  fetchWbgt: async () => {
    set({ isLoading: true, error: null });
    try {
      // 位置情報が未取得なら先に取得する。
      let location = get().location;
      if (!location) {
        const info: LocationInfo = await getCurrentLocation();
        location = info;
        set({ location: info });
      }

      const response = await fetchWeather({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      const current = buildCurrentWbgt(response);
      const hourlyForecast = buildHourlyForecast(response);
      set({
        current,
        hourlyForecast,
        sunEvents: buildSunEvents(response, hourlyForecast),
        lastUpdated: Date.now(),
        isLoading: false,
      });

      // 環境省データはセカンダリ。取得失敗してもアプリ全体は止めない。
      // 成功すれば推定値より優先して表示する（実データを尊重）。
      try {
        const envWbgt = await fetchEnvMinistryWbgt({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        set({ envMinistryWbgt: envWbgt });
      } catch {
        set({ envMinistryWbgt: null });
      }

      // 梅雨モード判定（6〜7 月のみ有効）。
      const tsuyuStatus = evaluateTsuyuStatus(response, getFlavor());
      set({ tsuyuStatus });

      // しきい値超過なら通知する（レート制限・権限は通知側で判定）。
      // 環境省データが得られていればそちらを優先して判定する。
      const effectiveWbgt = get().envMinistryWbgt?.wbgt ?? current.wbgt;
      await checkThresholdAndNotify(effectiveWbgt, location.placeName);

      // 梅雨モード: 室内湿度が高ければ湿度アラートも送信する。
      if (tsuyuStatus.isActive && tsuyuStatus.indoorHumidity >= 70) {
        await notifyHumidity(tsuyuStatus.indoorHumidity, location.placeName);
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '不明なエラーが発生しました',
        isLoading: false,
      });
    }
  },

  refreshLocation: async () => {
    set({ isLoading: true, error: null });
    try {
      const info = await getCurrentLocation();
      set({ location: info });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : '位置情報の取得に失敗しました',
        isLoading: false,
      });
      return;
    }
    // 新しい位置で天気を更新する。
    await get().fetchWbgt();
  },

  startAutoRefresh: () => {
    // すでに起動中なら多重起動しない。停止関数のみ返す。
    if (autoRefreshTimer) return stopAutoRefresh;

    const interval = useSettingsStore.getState().autoRefreshInterval;
    autoRefreshTimer = setInterval(() => {
      void get().fetchWbgt();
    }, interval);
    return stopAutoRefresh;
  },
}));
