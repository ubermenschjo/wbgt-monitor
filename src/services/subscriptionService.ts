/**
 * サブスクリプション管理サービス。
 *
 * RevenueCat (expo-purchases) を利用した課金フローを管理する。
 * biz flavor のみで使用され、consumer flavor では一切呼ばれない。
 *
 * ## B2B 価格ポリシー（無料ティアなし）
 * - ライト: ¥3,000/月 (年¥29,800) — 10人, アラート+記録保存
 * - スタンダード: ¥10,000/月 (年¥98,000) — 50人, チーム管理+帳票出力
 * - エンタープライズ: ¥30,000/月 — 無制限, API連携+カスタム
 */

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';

// RevenueCat API Keys（環境変数またはビルド時に設定）
const REVENUE_CAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS ?? '';
const REVENUE_CAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID ?? '';

/** サブスクリプションプラン識別子。 */
export type PlanId = 'lite' | 'standard' | 'enterprise';

/** プラン詳細情報。 */
export interface PlanInfo {
  id: PlanId;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  maxWorkers: number;
  features: string[];
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
  },
];

/** RevenueCat の Offering Identifier（ダッシュボードで設定）。 */
const OFFERING_ID = 'default';

/** RevenueCat の Entitlement Identifier。 */
const ENTITLEMENT_ID = 'biz_access';

/**
 * RevenueCat SDK を初期化する。
 * アプリ起動時に1回だけ呼び出す（biz flavor のみ）。
 */
export async function initializePurchases(): Promise<void> {
  const apiKey =
    Platform.OS === 'ios' ? REVENUE_CAT_API_KEY_IOS : REVENUE_CAT_API_KEY_ANDROID;

  if (!apiKey) {
    if (__DEV__) {
      console.warn('[SubscriptionService] RevenueCat API key not configured');
    }
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  await Purchases.configure({ apiKey });
}

/**
 * 現在のユーザーの購読状態を取得する。
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/**
 * 有効なサブスクリプションが存在するか判定する。
 */
export async function isSubscriptionActive(): Promise<boolean> {
  try {
    const info = await getCustomerInfo();
    return ENTITLEMENT_ID in (info.entitlements.active ?? {});
  } catch {
    // オフラインや初期化前はキャッシュにフォールバック
    return false;
  }
}

/**
 * 現在のプランIDを返す。未購読なら null。
 */
export async function getCurrentPlanId(): Promise<PlanId | null> {
  try {
    const info = await getCustomerInfo();
    const active = info.entitlements.active[ENTITLEMENT_ID];
    if (!active) return null;

    const productId = active.productIdentifier;
    if (productId.includes('lite')) return 'lite';
    if (productId.includes('standard')) return 'standard';
    if (productId.includes('enterprise')) return 'enterprise';
    return 'lite'; // fallback
  } catch {
    return null;
  }
}

/**
 * 利用可能なオファリング（プラン一覧）を取得する。
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? offerings.all[OFFERING_ID] ?? null;
  } catch {
    return null;
  }
}

/**
 * 指定パッケージを購入する。
 * @returns 購入成功なら CustomerInfo、キャンセルなら null
 */
export async function purchasePackage(
  packageId: string,
): Promise<CustomerInfo | null> {
  const offering = await getOfferings();
  if (!offering) throw new Error('オファリングの取得に失敗しました');

  const pkg = offering.availablePackages.find(
    (p) => p.identifier === packageId,
  );
  if (!pkg) throw new Error(`パッケージが見つかりません: ${packageId}`);

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: any) {
    if (e.userCancelled) return null;
    throw e;
  }
}

/**
 * 購入を復元する（機種変更時など）。
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/**
 * トライアル期間中かどうかを判定する。
 */
export async function isInTrialPeriod(): Promise<boolean> {
  try {
    const info = await getCustomerInfo();
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    if (!entitlement) return false;
    return entitlement.periodType === 'TRIAL';
  } catch {
    return false;
  }
}
