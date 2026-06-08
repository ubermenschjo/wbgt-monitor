/**
 * ナビゲーションのパラメータ型定義。
 *
 * ルートスタック（タブ + モーダル）と記録タブ内スタックを定義する。
 */

/** ルートスタックのルートとパラメータ。 */
export type RootStackParamList = {
  /** メインタブ画面。 */
  MainTabs: undefined;
  /** Paywall モーダル（biz flavor 限定）。 */
  Paywall: undefined;
};

/** タブナビゲーターのルート。 */
export type RootTabParamList = {
  Home: undefined;
  Record: undefined;
  Export: undefined;
  Settings: undefined;
};

/** 記録タブ内スタックのルートとパラメータ。 */
export type RecordStackParamList = {
  /** 記録一覧。 */
  RecordList: undefined;
  /** 記録詳細。対象の記録 id を受け取る。 */
  RecordDetail: { id: number };
};
