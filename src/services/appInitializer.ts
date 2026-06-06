/**
 * アプリ起動時の初期化処理。
 *
 * データベースの初期化・設定の読み込み・通知のセットアップ・
 * WBGT 自動更新の開始を順に行う。App のマウント時に一度だけ呼び出す。
 */

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
 * 3. 通知（ハンドラ・Android チャンネル）をセットアップする。
 * 4. 通知が有効なら権限を要求する。
 * 5. WBGT の自動更新を開始する（多重起動はストア側で防止）。
 */
export async function initializeApp(): Promise<void> {
  await setupDatabase();
  await useSettingsStore.getState().loadSettings();

  await setupNotifications();
  if (useSettingsStore.getState().notificationEnabled) {
    await requestNotificationPermissions();
  }

  useWbgtStore.getState().startAutoRefresh();
}
