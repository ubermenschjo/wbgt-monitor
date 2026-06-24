import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getFlavor } from '../hooks/useLabel';
import type { RiskLevel } from '../utils/constants';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from '../utils/constants';

const WIDGET_DATA_KEY = 'wbgt-widget-data';
export const WIDGET_SHARED_KEY = 'wbgt_widget_snapshot';
export const WIDGET_APP_GROUP_SUITE = 'group.com.stagen.wbgt.consumer.expowidgets';
const ANDROID_PACKAGE = 'com.stagen.wbgt.consumer';

export type WidgetSnapshot = {
  updatedAt: string;
  wbgt: number;
  riskLevel: RiskLevel;
  riskColor: string;
  riskLabel: string;
  placeName: string | null;
  isRecording: boolean;
  elapsedSec: number;
};

async function pushToNativeBridge(snapshot: WidgetSnapshot): Promise<void> {
  if (getFlavor() !== 'consumer') return;
  try {
    const { setWidgetData } = await import('@bittingz/expo-widgets');
    const json = JSON.stringify(snapshot);
    if (Platform.OS === 'android') {
      setWidgetData(json, ANDROID_PACKAGE);
    } else if (Platform.OS === 'ios') {
      setWidgetData(json);
    }
  } catch {
    // ponytail: Expo Go / 未 prebuild 時はネイティブブリッジなし
  }
}

export async function updateWidgetSnapshot(
  input: {
    wbgt: number;
    riskLevel: RiskLevel;
    placeName?: string | null;
    isRecording?: boolean;
    elapsedSec?: number;
  },
): Promise<WidgetSnapshot> {
  const snapshot: WidgetSnapshot = {
    updatedAt: new Date().toISOString(),
    wbgt: input.wbgt,
    riskLevel: input.riskLevel,
    riskColor: RISK_LEVEL_COLORS[input.riskLevel],
    riskLabel: RISK_LEVEL_LABELS[input.riskLevel],
    placeName: input.placeName ?? null,
    isRecording: input.isRecording ?? false,
    elapsedSec: input.elapsedSec ?? 0,
  };

  await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(snapshot));
  await pushToNativeBridge(snapshot);
  return snapshot;
}

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as WidgetSnapshot;
}

export async function clearWidgetSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(WIDGET_DATA_KEY);
}
