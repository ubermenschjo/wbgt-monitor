/** サブスクリプションプラン識別子。 */
export type PlanId = 'lite' | 'standard' | 'enterprise';

/** RevenueCat / App Store Connect の商品 ID（ベース）。 */
export const PRODUCT_IDS: Record<PlanId, string> = {
  lite: 'biz_lite',
  standard: 'biz_standard',
  enterprise: 'biz_enterprise',
};

/** Google Play インポート後の RevenueCat 商品 ID（subscriptionId:basePlanId） */
export const STORE_PRODUCT_ALIASES: Record<PlanId, readonly string[]> = {
  lite: ['biz_lite', 'lite'],
  standard: ['biz_standard', 'standard'],
  enterprise: ['biz_enterprise', 'enterprise'],
};

/** RevenueCat Offering 内 Package identifier の別名 */
export const PACKAGE_ID_ALIASES: Record<PlanId, readonly string[]> = {
  lite: ['lite', 'rc_lite', '$rc_monthly', 'monthly', 'biz_lite'],
  standard: ['standard', 'rc_standard', '$rc_monthly', 'monthly', 'biz_standard'],
  enterprise: ['enterprise', 'rc_enterprise', '$rc_monthly', 'monthly', 'biz_enterprise'],
};

/** プラン詳細情報。 */
export interface PlanInfo {
  id: PlanId;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  maxWorkers: number;
  features: string[];
  /** v1.0 で購入可能か。false なら UI で「準備中」表示。 */
  available: boolean;
}

/** プラン定義（表示用）。 */
export const PLANS: PlanInfo[] = [
  {
    id: 'lite',
    name: 'ライト',
    monthlyPrice: '¥3,000',
    annualPrice: '¥29,800',
    maxWorkers: 10,
    features: ['WBGTリアルタイム監視', 'アラート通知', '記録保存', 'CSV書き出し'],
    available: true,
  },
  {
    id: 'standard',
    name: 'スタンダード',
    monthlyPrice: '¥10,000',
    annualPrice: '¥98,000',
    maxWorkers: 50,
    features: [
      'ライトの全機能',
      'チーム管理（50人）',
      'コンプライアンス帳票',
      'PDF出力',
      '複数現場対応',
    ],
    available: false, // Phase 2 で解禁
  },
  {
    id: 'enterprise',
    name: 'エンタープライズ',
    monthlyPrice: '¥30,000',
    annualPrice: '¥298,000',
    maxWorkers: Infinity,
    features: [
      'スタンダードの全機能',
      '無制限ワーカー',
      'API連携',
      'カスタムレポート',
      '専用サポート',
    ],
    available: false, // Phase 3 で解禁
  },
];

/** v1.0 で購入可能なプランのみ。 */
export const AVAILABLE_PLANS = PLANS.filter((p) => p.available);
