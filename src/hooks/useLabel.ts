import Constants from 'expo-constants';

import bizLabels from '../../i18n/biz.json';
import consumerLabels from '../../i18n/consumer.json';

export type Flavor = 'biz' | 'consumer';

export interface Labels {
  appName: string;
  startButton: string;
  endButton: string;
  recordSection: string;
  workerCount: string | null;
  measureLabel: string;
  csvExport: boolean;
  /** 書き出しセクション見出し（biz のみ）。 */
  exportSection?: string;
  /** CSV 書き出しの選択肢ラベル（biz のみ）。 */
  exportCSV?: string;
  /** PDF 書き出しの選択肢ラベル（biz のみ）。 */
  exportPDF?: string;
  /** 会社名の入力ラベル（biz のみ）。 */
  companyName?: string;
  /** 現場名の入力ラベル（biz のみ）。 */
  siteName?: string;
  /** 共有ボタンのラベル（consumer のみ）。 */
  shareButton?: string;
  /** 設定画面の通知 ON/OFF ラベル。 */
  notificationSettingsLabel: string;
  /** WBGT しきい値超過のプッシュ通知タイトル。 */
  notificationWbgtTitle: string;
  /** WBGT しきい値超過のプッシュ通知本文（{value} {place} を置換）。 */
  notificationWbgtBody: string;
  /** 湿度アラートのプッシュ通知タイトル。 */
  notificationHumidityTitle: string;
  /** 湿度アラートのプッシュ通知本文（{humidity} {place} を置換）。 */
  notificationHumidityBody: string;
  /** オンボーディングの通知説明文。 */
  notificationOnboardingDescription: string;
}

const labelMap: Record<Flavor, Labels> = {
  biz: bizLabels as Labels,
  consumer: consumerLabels as Labels,
};

/**
 * ビルド時に確定するフレーバー。
 * バックグラウンドタスクなど実行コンテキストが変わっても同じ値を返す。
 */
export const resolvedFlavor: Flavor = (() => {
  const fromExtra = Constants.expoConfig?.extra?.appFlavor;
  if (fromExtra === 'biz' || fromExtra === 'consumer') return fromExtra;
  const fromEnv = process.env.APP_FLAVOR;
  if (fromEnv === 'biz' || fromEnv === 'consumer') return fromEnv;
  return 'biz';
})();

export function getFlavor(): Flavor {
  return resolvedFlavor;
}

export function getLabels(): Labels {
  return labelMap[resolvedFlavor];
}

export function useLabel(): Labels {
  return getLabels();
}
