/**
 * アプリ設定の状態管理ストア（zustand）。
 *
 * 通知の ON/OFF・WBGT 通知しきい値・自動更新間隔を保持し、
 * 変更は即座に SQLite の 'settings' テーブルへ永続化する。
 * 起動時に loadSettings で保存済みの値を読み込む。
 */

import { create } from 'zustand';

import { getAllSettings, saveSetting } from '../services/database';
import { DEFAULT_SETTINGS } from '../utils/constants';

/** 永続化する設定値。 */
export interface Settings {
  /** 熱中症アラート通知の ON/OFF。 */
  notificationEnabled: boolean;
  /** WBGT 通知しきい値（℃）。 */
  wbgtThreshold: number;
  /** 自動更新間隔（ミリ秒）。 */
  autoRefreshInterval: number;
  /** 会社名（biz のエクスポート用）。 */
  companyName: string;
  /** 現場名（biz のエクスポート用）。 */
  siteName: string;
}

/** 既定の設定値。 */
const DEFAULTS: Settings = {
  notificationEnabled: true,
  wbgtThreshold: 28,
  autoRefreshInterval: DEFAULT_SETTINGS.autoRefreshIntervalMs,
  companyName: '',
  siteName: '',
};

interface SettingsState extends Settings {
  /** SQLite からの読み込みが完了したか。 */
  loaded: boolean;

  /** 保存済みの設定を SQLite から読み込む。 */
  loadSettings: () => Promise<void>;
  /** 設定を部分更新し、変更分を SQLite に永続化する。 */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

/** 文字列 → 真偽値（'true' のみ true）。 */
function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true';
}

/** 文字列 → 数値（不正値は既定値にフォールバック）。 */
function parseNum(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  loadSettings: async () => {
    try {
      const rows = await getAllSettings();
      set({
        notificationEnabled: parseBool(
          rows.notificationEnabled,
          DEFAULTS.notificationEnabled,
        ),
        wbgtThreshold: parseNum(rows.wbgtThreshold, DEFAULTS.wbgtThreshold),
        autoRefreshInterval: parseNum(
          rows.autoRefreshInterval,
          DEFAULTS.autoRefreshInterval,
        ),
        companyName: rows.companyName ?? DEFAULTS.companyName,
        siteName: rows.siteName ?? DEFAULTS.siteName,
        loaded: true,
      });
    } catch {
      // 読み込み失敗時は既定値のまま「読み込み済み」とする。
      set({ loaded: true });
    }
  },

  updateSettings: async (patch) => {
    set(patch);
    // 変更されたキーのみ永続化する。
    await Promise.all(
      Object.entries(patch).map(([key, value]) =>
        saveSetting(key, String(value)),
      ),
    );
  },
}));
