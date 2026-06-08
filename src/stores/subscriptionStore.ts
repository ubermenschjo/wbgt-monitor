/**
 * サブスクリプション状態の Zustand ストア。
 *
 * biz flavor 限定。consumer flavor では isActive が常に true を返す。
 * アプリ起動時に checkSubscription() を呼び出して状態を同期する。
 */

import { create } from 'zustand';
import { getFlavor } from '../hooks/useLabel';
import {
  type PlanId,
  isSubscriptionActive,
  getCurrentPlanId,
  isInTrialPeriod,
  initializePurchases,
} from '../services/subscriptionService';

export interface SubscriptionState {
  /** SDK初期化済みか */
  initialized: boolean;
  /** 有効なサブスクリプションがあるか */
  isActive: boolean;
  /** 現在のプラン */
  currentPlan: PlanId | null;
  /** トライアル中か */
  isTrial: boolean;
  /** ローディング状態 */
  loading: boolean;
  /** エラー */
  error: string | null;

  /** SDK初期化 + 状態チェック */
  initialize: () => Promise<void>;
  /** 購読状態を再チェック */
  checkSubscription: () => Promise<void>;
  /** 状態をリセット（ログアウト時など） */
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  initialized: false,
  isActive: getFlavor() === 'consumer', // consumer は常にアクティブ
  currentPlan: null,
  isTrial: false,
  loading: false,
  error: null,

  initialize: async () => {
    // consumer flavor では何もしない
    if (getFlavor() === 'consumer') {
      set({ initialized: true, isActive: true });
      return;
    }

    set({ loading: true, error: null });
    try {
      await initializePurchases();
      set({ initialized: true });
      await get().checkSubscription();
    } catch (e: any) {
      set({ error: e.message ?? '初期化に失敗しました', loading: false });
    }
  },

  checkSubscription: async () => {
    if (getFlavor() === 'consumer') return;

    set({ loading: true, error: null });
    try {
      const [active, plan, trial] = await Promise.all([
        isSubscriptionActive(),
        getCurrentPlanId(),
        isInTrialPeriod(),
      ]);
      set({
        isActive: active,
        currentPlan: plan,
        isTrial: trial,
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message ?? '状態取得に失敗しました', loading: false });
    }
  },

  reset: () => {
    set({
      isActive: getFlavor() === 'consumer',
      currentPlan: null,
      isTrial: false,
      error: null,
    });
  },
}));
