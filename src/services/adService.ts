/**
 * consumer フレーバー向け AdMob App Open 広告サービス。
 *
 * biz ビルドにはネイティブモジュールがリンクされないため、
 * 最上位の static import は行わず動的 import で読み込む。
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { getFlavor } from '../hooks/useLabel';
import { useRecordStore } from '../stores/recordStore';

/** App Open 広告の再表示までの最小間隔（4 時間）。 */
const SHOW_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** 初回表示時の広告ロード待ちタイムアウト（8 秒）。 */
const AD_LOAD_TIMEOUT_MS = 8_000;

type AdsModule = typeof import('react-native-google-mobile-ads');

let adsModule: AdsModule | null = null;
let appOpenAd: ReturnType<AdsModule['AppOpenAd']['createForAdRequest']> | null = null;
let isShowing = false;
let lastShownAt = 0;
let unloadListeners: (() => void)[] = [];
let adsInitialized = false;
let initPromise: Promise<void> | null = null;

function getAppOpenUnitId(): string {
  const extra = Constants.expoConfig?.extra;
  return Platform.OS === 'ios'
    ? ((extra?.admobAppOpenIos as string | undefined) ?? '')
    : ((extra?.admobAppOpenAndroid as string | undefined) ?? '');
}

/** 間隔・記録中アラートなど、ロード状態を除く表示スキップ条件。 */
function shouldSkipAppOpenAd(): boolean {
  if (getFlavor() !== 'consumer') return true;

  const { isRecording, alertPending } = useRecordStore.getState();
  if (isRecording && alertPending) return true;

  if (lastShownAt > 0 && Date.now() - lastShownAt < SHOW_INTERVAL_MS) {
    return true;
  }

  return false;
}

/** App Open 広告を表示してよいか判定する。 */
export function canShowAppOpenAd(): boolean {
  if (shouldSkipAppOpenAd()) return false;
  if (!appOpenAd?.loaded || isShowing) return false;
  return true;
}

function setupAppOpenAd(): void {
  if (!adsModule) return;

  const { AppOpenAd, AdEventType, TestIds } = adsModule;
  const adUnitId = __DEV__ ? TestIds.APP_OPEN : getAppOpenUnitId();

  if (!adUnitId) return;

  appOpenAd = AppOpenAd.createForAdRequest(adUnitId);

  const unsubClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
    isShowing = false;
    lastShownAt = Date.now();
    appOpenAd?.load();
  });

  const unsubError = appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
    isShowing = false;
    setTimeout(() => appOpenAd?.load(), 30_000);
  });

  unloadListeners = [unsubClosed, unsubError];
  appOpenAd.load();
}

/** AdMob SDK を初期化し、App Open 広告のプリロードを開始する。 */
export async function initializeAds(): Promise<void> {
  if (getFlavor() !== 'consumer') return;
  if (adsInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    adsModule = await import('react-native-google-mobile-ads');
    const mobileAds = adsModule.default;

    if (__DEV__) {
      await mobileAds().setRequestConfiguration({
        testDeviceIdentifiers: ['EMULATOR'],
      });
    }

    if (Platform.OS === 'ios') {
      const {
        getTrackingPermissionsAsync,
        requestTrackingPermissionsAsync,
      } = await import('expo-tracking-transparency');
      const { status } = await getTrackingPermissionsAsync();
      if (status === 'undetermined') {
        await requestTrackingPermissionsAsync();
      }
    }

    await mobileAds().initialize();
    setupAppOpenAd();
    adsInitialized = true;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

/** 広告のロード完了を待つ。タイムアウト時は false を返す。 */
function waitForAdLoaded(): Promise<boolean> {
  if (appOpenAd?.loaded) return Promise.resolve(true);
  if (!adsModule || !appOpenAd) return Promise.resolve(false);

  return new Promise((resolve) => {
    const { AdEventType } = adsModule!;
    let unsub: (() => void) | undefined;

    const timeout = setTimeout(() => {
      unsub?.();
      resolve(false);
    }, AD_LOAD_TIMEOUT_MS);

    unsub = appOpenAd!.addAdEventListener(AdEventType.LOADED, () => {
      clearTimeout(timeout);
      unsub?.();
      resolve(true);
    });
  });
}

/** 表示中の広告が閉じる（またはエラーになる）まで待つ。 */
function waitForAdDismissed(): Promise<void> {
  if (!isShowing || !adsModule || !appOpenAd) return Promise.resolve();

  return new Promise((resolve) => {
    const { AdEventType } = adsModule!;
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      unsubClosed();
      unsubError();
      resolve();
    };

    const unsubClosed = appOpenAd!.addAdEventListener(AdEventType.CLOSED, finish);
    const unsubError = appOpenAd!.addAdEventListener(AdEventType.ERROR, finish);
  });
}

/**
 * コールドスタート時の App Open 広告を表示し、閉じるまで待つ。
 * 表示条件を満たさない場合、またはロード失敗時は即座に resolve する。
 */
export async function runFirstAppOpenAd(): Promise<void> {
  if (getFlavor() !== 'consumer') return;

  await initializeAds();

  if (shouldSkipAppOpenAd()) return;

  const loaded = await waitForAdLoaded();
  if (!loaded || !appOpenAd) return;

  try {
    isShowing = true;
    await appOpenAd.show();
  } catch {
    isShowing = false;
    return;
  }

  await waitForAdDismissed();
}

/** 条件を満たす場合に App Open 広告を表示する。 */
export async function showAppOpenAdIfReady(): Promise<void> {
  if (!canShowAppOpenAd() || !appOpenAd) return;

  try {
    isShowing = true;
    await appOpenAd.show();
  } catch {
    isShowing = false;
  }
}

/** リスナーと広告インスタンスを破棄する。 */
export function cleanupAds(): void {
  unloadListeners.forEach((unsub) => unsub());
  unloadListeners = [];
  appOpenAd?.removeAllListeners();
  appOpenAd = null;
  adsModule = null;
  isShowing = false;
  adsInitialized = false;
  initPromise = null;
}
