/**
 * WBGT（暑さ指数）に関する定数定義。
 * しきい値・リスクレベルの色・既定設定をまとめて管理する。
 */

/**
 * リスクレベル（1〜5）。
 * 数値が大きいほど危険度が高い。
 */
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

/**
 * 各リスクレベルの WBGT 下限値（℃）。
 * 区間は [min, 次のレベルの min) で判定する。
 */
export const WBGT_THRESHOLDS: Record<RiskLevel, number> = {
  1: 0, // ほぼ安全: WBGT < 21
  2: 21, // 注意: 21 <= WBGT < 25
  3: 25, // 警戒: 25 <= WBGT < 28
  4: 28, // 厳重警戒: 28 <= WBGT < 31
  5: 31, // 危険: WBGT >= 31
};

/**
 * 各リスクレベルの日本語ラベル。
 */
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  1: 'ほぼ安全',
  2: '注意',
  3: '警戒',
  4: '厳重警戒',
  5: '危険',
};

/**
 * 各リスクレベルの表示色（環境省の暑さ指数に準拠した配色）。
 */
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  1: '#2196F3', // ほぼ安全（青）
  2: '#8BC34A', // 注意（緑）
  3: '#FFEB3B', // 警戒（黄）
  4: '#FF9800', // 厳重警戒（橙）
  5: '#F44336', // 危険（赤）
};

/**
 * 記録時に提示する活動種別のプリセット（フレーバー別）。
 * 末尾の「カスタム入力」は RecordingSheet 側で別途扱う。
 */
export const ACTIVITY_PRESETS: Record<'biz' | 'consumer', string[]> = {
  biz: ['屋外作業', '建設作業', '農作業', '運搬・配送', '点検・巡回'],
  consumer: ['散歩', 'ランニング', 'スポーツ', '買い物', '通勤・通学', 'レジャー'],
};

/**
 * 記録時に選択できる「講じた措置 / 熱中症対策」の選択肢（フレーバー別）。
 */
export const MEASURE_PRESETS: Record<'biz' | 'consumer', string[]> = {
  biz: [
    '休憩確保',
    '水分・塩分補給',
    '作業時間短縮',
    '作業中止',
    '日よけ設置',
    'WBGT低減措置',
  ],
  consumer: ['水分補給した', '日陰で休憩', '帽子着用', '冷却グッズ使用', '活動を中止'],
};

/**
 * 記録中の WBGT 追跡ポーリング間隔（ミリ秒）。5 分。
 */
export const RECORDING_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 記録一覧の 1 ページあたりの取得件数。
 */
export const RECORDS_PAGE_SIZE = 20;

/**
 * アプリの既定設定値。
 */
export const DEFAULT_SETTINGS = {
  /** ストアの自動更新間隔（ミリ秒）。10 分。 */
  autoRefreshIntervalMs: 10 * 60 * 1000,
  /** 天気 API レスポンスのキャッシュ有効期間（ミリ秒）。5 分。 */
  weatherCacheTtlMs: 5 * 60 * 1000,
  /** 天気 API 取得の最大リトライ回数。 */
  maxRetryAttempts: 3,
  /** 取得する時系列予報の時間数（次の 24 時間）。 */
  forecastHours: 24,
  /** 位置情報が取得できない場合のフォールバック座標（東京駅）。 */
  fallbackLocation: {
    latitude: 35.681236,
    longitude: 139.767125,
    placeName: '東京',
  },
} as const;
