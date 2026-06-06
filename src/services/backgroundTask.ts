/**
 * バックグラウンドでの WBGT 監視タスク（expo-task-manager + expo-background-fetch）。
 *
 * 端末がバックグラウンド/終了状態でも一定間隔で起動し、
 *   1. 現在地を取得する
 *   2. 天気データを取得して WBGT を算出する
 *   3. WBGT がしきい値を超えていればローカル通知を出す
 * を実行する。
 *
 * バックグラウンドでは JS が新規に立ち上がるため zustand ストアの状態は
 * 空である。設定は SQLite から読み直し、必要なサービスを直接呼び出す。
 *
 * 注意:
 *   バックグラウンド実行間隔は OS が最適化するため、指定値ぴったりにはならない。
 *   iOS の最小間隔は約 15 分。
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { setupDatabase } from './database';
import { getCurrentLocation } from './locationService';
import { notifyWbgtThreshold } from './notificationService';
import { fetchWeather, type OpenMeteoResponse } from './weatherApi';
import { calculateWbgt } from './wbgtCalculator';
import { useSettingsStore } from '../stores/settingsStore';

/** バックグラウンドタスク名。register/unregister で共通利用する。 */
export const WBGT_BACKGROUND_FETCH = 'WBGT_BACKGROUND_FETCH';

/** バックグラウンド実行の最小間隔（秒）。15 分 = iOS の実質的な最小値。 */
const MINIMUM_INTERVAL_SECONDS = 15 * 60;

/**
 * OpenMeteo レスポンスから現在時刻に対応する hourly のインデックスを求める。
 * current_weather.time と一致する要素を優先し、無ければ 0 にフォールバックする。
 */
function findCurrentHourIndex(response: OpenMeteoResponse): number {
  const index = response.hourly.time.indexOf(response.current_weather.time);
  return index >= 0 ? index : 0;
}

/**
 * バックグラウンドでの監視 1 回分を実行する。
 *
 * @returns 新しいデータを取得できた場合は NewData、それ以外は NoData
 */
async function runMonitoring(): Promise<BackgroundFetch.BackgroundFetchResult> {
  // ストアは空なので SQLite から設定を読み直す。
  await setupDatabase();
  await useSettingsStore.getState().loadSettings();
  const { notificationEnabled, wbgtThreshold } = useSettingsStore.getState();

  // 通知が無効ならデータ取得自体を省略する。
  if (!notificationEnabled) {
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  const location = await getCurrentLocation();
  const response = await fetchWeather({
    latitude: location.latitude,
    longitude: location.longitude,
  });

  const index = findCurrentHourIndex(response);
  const { hourly, current_weather } = response;
  const { wbgt } = calculateWbgt({
    temperature: current_weather.temperature,
    windSpeed: current_weather.windspeed,
    relativeHumidity: hourly.relative_humidity_2m[index] ?? 0,
    directRadiation: hourly.direct_radiation[index] ?? 0,
  });

  // しきい値超過のときだけ通知する（権限・レート制限は通知側で判定）。
  if (wbgt >= wbgtThreshold) {
    await notifyWbgtThreshold(wbgt, location.placeName);
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
}

// タスク定義はグローバルスコープで行う必要がある（モジュール読み込み時に実行）。
TaskManager.defineTask(WBGT_BACKGROUND_FETCH, async () => {
  try {
    return await runMonitoring();
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * バックグラウンド監視タスクを登録する（アプリ起動時に呼び出す）。
 *
 * すでに登録済みの場合は何もしない。バックグラウンド実行が利用できない
 * 環境（Expo Go の一部・web 等）では静かにスキップする。
 */
export async function registerBackgroundTask(): Promise<void> {
  try {
    const available = await TaskManager.isAvailableAsync();
    if (!available) return;

    const alreadyRegistered =
      await TaskManager.isTaskRegisteredAsync(WBGT_BACKGROUND_FETCH);
    if (alreadyRegistered) return;

    await BackgroundFetch.registerTaskAsync(WBGT_BACKGROUND_FETCH, {
      minimumInterval: MINIMUM_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // 登録に失敗してもアプリの起動は妨げない。
  }
}

/** バックグラウンド監視タスクの登録を解除する。 */
export async function unregisterBackgroundTask(): Promise<void> {
  try {
    const registered =
      await TaskManager.isTaskRegisteredAsync(WBGT_BACKGROUND_FETCH);
    if (registered) {
      await BackgroundFetch.unregisterTaskAsync(WBGT_BACKGROUND_FETCH);
    }
  } catch {
    // 解除失敗は無視する。
  }
}
