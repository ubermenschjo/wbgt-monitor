/**
 * アプリ起動時の初期化処理。
 *
 * データベースの初期化・設定の読み込み・通知のセットアップ・
 * WBGT 自動更新の開始・バックグラウンド監視タスクの登録を順に行う。
 * App のマウント時に一度だけ呼び出す。
 */

import { getFlavor } from '../hooks/useLabel';
import { registerBackgroundTask } from './backgroundTask';
import { initializeAds } from './adService';
import { setupDatabase } from './database';
import {
  requestNotificationPermissions,
  setupNotifications,
} from './notificationService';
import { useSettingsStore } from '../stores/settingsStore';
import { useWbgtStore } from '../stores/wbgtStore';

/**
 * アプリの初期化を実行する。
 *
 * 1. データベースを初期化する。
 * 2. 保存済みの設定を読み込む。
 * 3. WBGT の自動更新を開始し、天気データの先行取得を開始する。
 * 4. consumer なら AdMob のプリロードを開始する。
 * 5. 通知（ハンドラ・Android チャンネル）をセットアップする。
 * 6. 通知が有効なら権限を要求する。
 * 7. バックグラウンド監視タスクを登録する（登録済みなら何もしない）。
 */
export async function initializeApp(): Promise<void> {
  await setupDatabase();
  await useSettingsStore.getState().loadSettings();

  // UI / 広告表示と並行して先行取得する。
  useWbgtStore.getState().startAutoRefresh();
  void useWbgtStore.getState().fetchWbgt();

  if (getFlavor() === 'consumer') {
    void initializeAds();
  }

  await setupNotifications();
  if (useSettingsStore.getState().notificationEnabled) {
    await requestNotificationPermissions();
  }

  await registerBackgroundTask();
}
