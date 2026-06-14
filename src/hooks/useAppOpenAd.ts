/**
 * consumer フレーバー向け App Open 広告フック。
 *
 * フォアグラウンド復帰時に App Open 広告を表示する。
 * コールドスタート時の初回表示は App.tsx の runFirstAppOpenAd が担当する。
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { cleanupAds, showAppOpenAdIfReady } from '../services/adService';
import { getFlavor } from './useLabel';

/**
 * App Open 広告のフォアグラウンド復帰表示を管理する。
 *
 * @param enabled オンボーディング完了後に true を渡す。
 */
export function useAppOpenAd(enabled: boolean): void {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!enabled || getFlavor() !== 'consumer') return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          void showAppOpenAdIfReady();
        }
        appState.current = nextState;
      },
    );

    return () => {
      subscription.remove();
      cleanupAds();
    };
  }, [enabled]);
}
