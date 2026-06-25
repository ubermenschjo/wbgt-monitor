/**
 * 記録中の Live Activity 更新（iOS / consumer のみ）。
 * ponytail: ActivityKit ネイティブは @bittingz/expo-widgets prebuild 後に有効。
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { getFlavor } from '../hooks/useLabel';
import type { RiskLevel } from '../utils/constants';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from '../utils/constants';
import { updateWidgetSnapshot } from './widgetData';

let liveActivityId: string | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let recordingStartedAt: number | null = null;

function stopTick(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

type ExpoWidgetsNative = {
  startLiveActivity?: (payload: unknown) => Promise<string>;
  updateLiveActivity?: (id: string, payload: unknown) => Promise<void>;
  endLiveActivity?: (id: string) => void;
};

function loadExpoWidgets(): ExpoWidgetsNative | null {
  return requireOptionalNativeModule<ExpoWidgetsNative>('ExpoWidgets');
}

async function tryEndLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || getFlavor() !== 'consumer') return;
  const mod = loadExpoWidgets();
  if (mod?.endLiveActivity && liveActivityId) {
    mod.endLiveActivity(liveActivityId);
  }
  liveActivityId = null;
}

export async function startRecordingLiveActivity(
  wbgt: number,
  riskLevel: RiskLevel,
  placeName: string | null,
): Promise<void> {
  if (getFlavor() !== 'consumer') return;

  recordingStartedAt = Date.now();
  stopTick();

  await updateWidgetSnapshot({
    wbgt,
    riskLevel,
    placeName,
    isRecording: true,
    elapsedSec: 0,
  });

  if (Platform.OS === 'ios') {
    const mod = loadExpoWidgets();
    if (mod?.startLiveActivity) {
      liveActivityId = await mod.startLiveActivity({
        attributes: {
          placeName: placeName ?? '現在地',
        },
        contentState: {
          wbgt,
          riskLabel: RISK_LEVEL_LABELS[riskLevel],
          riskColor: RISK_LEVEL_COLORS[riskLevel],
          elapsedSec: 0,
        },
      });
    }
  }

  tickTimer = setInterval(() => {
    if (recordingStartedAt == null) return;
    const elapsedSec = Math.floor((Date.now() - recordingStartedAt) / 1000);
    void updateWidgetSnapshot({
      wbgt,
      riskLevel,
      placeName,
      isRecording: true,
      elapsedSec,
    });
  }, 30_000);
}

export async function updateRecordingLiveActivity(
  wbgt: number,
  riskLevel: RiskLevel,
  placeName: string | null,
): Promise<void> {
  if (getFlavor() !== 'consumer' || recordingStartedAt == null) return;

  const elapsedSec = Math.floor((Date.now() - recordingStartedAt) / 1000);
  await updateWidgetSnapshot({
    wbgt,
    riskLevel,
    placeName,
    isRecording: true,
    elapsedSec,
  });

  if (Platform.OS === 'ios' && liveActivityId) {
    const mod = loadExpoWidgets();
    if (mod?.updateLiveActivity) {
      await mod.updateLiveActivity(liveActivityId, {
        wbgt,
        riskLabel: RISK_LEVEL_LABELS[riskLevel],
        riskColor: RISK_LEVEL_COLORS[riskLevel],
        elapsedSec,
      });
    }
  }
}

export async function endRecordingLiveActivity(
  wbgt: number,
  riskLevel: RiskLevel,
  placeName: string | null,
): Promise<void> {
  stopTick();
  recordingStartedAt = null;
  await tryEndLiveActivity();
  await updateWidgetSnapshot({
    wbgt,
    riskLevel,
    placeName,
    isRecording: false,
    elapsedSec: 0,
  });
}
