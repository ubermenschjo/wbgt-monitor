/**
 * サブスクリプションゲートフック。
 *
 * biz flavor で未課金ユーザーが制限画面にアクセスした場合、
 * Paywall へリダイレクトする。consumer flavor では常にアクセス許可。
 *
 * ## 使用例
 * ```tsx
 * export default function RecordScreen() {
 *   const { gated } = useSubscriptionGate();
 *   if (gated) return null; // Paywall へリダイレクト済み
 *   // ...通常のレンダリング
 * }
 * ```
 */

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getFlavor } from './useLabel';
import { useSubscriptionStore } from '../stores/subscriptionStore';

interface GateResult {
  /** true ならゲートにブロックされた（Paywall遷移済み）。 */
  gated: boolean;
  /** 購読がアクティブか。 */
  isActive: boolean;
  /** ローディング中か。 */
  loading: boolean;
}

/**
 * 画面単位で購読ゲートを適用する。
 * biz flavor で未課金なら Paywall へ navigate する。
 */
export function useSubscriptionGate(): GateResult {
  const navigation = useNavigation<any>();
  const { isActive, loading } = useSubscriptionStore();
  const isBiz = getFlavor() === 'biz';

  const shouldGate = isBiz && !isActive && !loading;

  useEffect(() => {
    if (shouldGate) {
      navigation.navigate('Paywall');
    }
  }, [shouldGate, navigation]);

  return {
    gated: shouldGate,
    isActive: isBiz ? isActive : true,
    loading,
  };
}
