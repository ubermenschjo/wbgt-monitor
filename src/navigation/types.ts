/**
 * ナビゲーションのパラメータ型定義。
 *
 * 記録タブ内のスタックナビゲーター（一覧 → 詳細）で受け渡すパラメータを定義する。
 */

/** 記録タブ内スタックのルートとパラメータ。 */
export type RecordStackParamList = {
  /** 記録一覧。 */
  RecordList: undefined;
  /** 記録詳細。対象の記録 id を受け取る。 */
  RecordDetail: { id: number };
};
