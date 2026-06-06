/**
 * ローカル通知サービス（expo-notifications のラッパー）。
 *
 * 通知の初期化（ハンドラ設定・Android チャンネル作成）、権限要求、
 * WBGT がしきい値を超えた際のローカル通知のスケジュールを提供する。
 * 通知文面はフレーバー（biz / consumer）で切り替える。
 * 同一内容の通知が短時間に連続しないよう、30 分のレート制限を設ける。
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getFlavor } from '../hooks/useLabel';

/** Android の通知チャンネル ID。 */
const ANDROID_CHANNEL_ID = 'wbgt-alert';

/** 通知のレート制限間隔（ミリ秒）。30 分。 */
const RATE_LIMIT_MS = 30 * 60 * 1000;

/** 位置情報が無い場合に文面へ埋め込む地名。 */
const UNKNOWN_PLACE = '不明な場所';

/**
 * 直近に通知を送信した時刻（epoch ミリ秒）。
 * レート制限の判定に用いる。state には持たずモジュールスコープで管理する。
 */
let lastNotifiedAt: number | null = null;

/** 通知権限の状態。 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/** expo の権限ステータス文字列を内部表現へ変換する。 */
function mapStatus(status: string): NotificationPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

/**
 * 通知の初期化を行う。
 *
 * - フォアグラウンドでの通知表示挙動を設定する。
 * - Android では 'wbgt-alert' チャンネル（高重要度）を作成する。
 *
 * 権限の要求は行わない（requestNotificationPermissions を別途呼ぶ）。
 */
export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '熱中症アラート',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });
  }
}

/**
 * 現在の通知権限の状態を取得する。
 *
 * @returns 権限の状態。取得に失敗した場合は 'denied'
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

/**
 * 通知権限を要求する（未許可かつ要求可能な場合のみ）。
 *
 * すでに許可済みなら再要求しない。再要求できない（恒久的に拒否された）場合は
 * 現状の状態を返す。例外時は 'denied' を返してアプリを落とさない。
 *
 * @returns 要求後の権限の状態
 */
export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return 'granted';
    if (!existing.canAskAgain) return mapStatus(existing.status);

    const requested = await Notifications.requestPermissionsAsync();
    return mapStatus(requested.status);
  } catch {
    return 'denied';
  }
}

/** フレーバーに応じた通知のタイトルと本文を組み立てる。 */
function buildContent(value: number, place: string | null): { title: string; body: string } {
  const placeName = place ?? UNKNOWN_PLACE;
  // 表示桁を揃える（WBGT は小数第 1 位まで）。
  const valueText = value.toFixed(1);

  if (getFlavor() === 'biz') {
    return {
      title: 'WBGT 警告',
      body: `WBGT ${valueText}℃ 超過。作業中断を検討してください。現在地: ${placeName}`,
    };
  }
  return {
    title: '熱中症警戒',
    body: `熱中症警戒！WBGT ${valueText}℃ です。水分補給・休憩を。(${placeName})`,
  };
}

/**
 * WBGT がしきい値を超えた際のローカル通知をスケジュールする。
 *
 * 以下の場合は通知せず false を返す:
 *   - 直近の通知から 30 分（レート制限）が経過していない
 *   - 通知権限が許可されていない
 *
 * @param value 現在の WBGT 値（℃）
 * @param place 現在地の地名（null の場合は「不明な場所」）
 * @returns 通知をスケジュールした場合は true
 */
export async function notifyWbgtThreshold(
  value: number,
  place: string | null,
): Promise<boolean> {
  const now = Date.now();
  if (lastNotifiedAt !== null && now - lastNotifiedAt < RATE_LIMIT_MS) {
    return false;
  }

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return false;

  const { title, body } = buildContent(value, place);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: 'wbgt-alert', screen: 'Home' },
    },
    // channelId を指定した即時通知（Android は 'wbgt-alert' チャンネルを使用）。
    trigger: { channelId: ANDROID_CHANNEL_ID },
  });

  lastNotifiedAt = now;
  return true;
}
