/**
 * 作業/活動記録の状態管理ストア（zustand）。
 *
 * 記録中の状態（isRecording / currentRecord）と、保存済み記録の一覧
 * （ページネーション対応）を保持する。開始時に現在地と WBGT を取得して
 * 記録を作成し、記録中は 5 分ごとに WBGT を再取得して最大値を追跡する。
 * 終了時に終了 WBGT・所要時間を確定して保存する。
 *
 * v2: 一時中断/再開、シート表示制御、アラート対応を追加。
 */

import { create } from 'zustand';

import {
  type NewWorkRecord,
  type WorkRecord,
  deleteRecord as dbDeleteRecord,
  getRecords as dbGetRecords,
  insertRecord,
  insertRecordEvent,
  updateRecord,
} from '../services/database';
import { getCurrentLocation } from '../services/locationService';
import { getFlavor } from '../hooks/useLabel';
import { RECORDING_POLL_INTERVAL_MS, RECORDS_PAGE_SIZE } from '../utils/constants';
import { useWbgtStore } from './wbgtStore';

/** 記録中に編集可能なフィールド（RecordingSheet から更新する）。 */
export type RecordDraftPatch = Partial<
  Pick<WorkRecord, 'activityType' | 'workerCount' | 'measures' | 'memo'>
>;

/** startRecording に渡す初期入力。 */
export interface StartRecordingInput {
  activityType: string;
  workerCount: number | null;
}

interface RecordState {
  /** 記録中かどうか。 */
  isRecording: boolean;
  /** 一時中断中かどうか。 */
  isPaused: boolean;
  /** 中断開始時刻（ISO）。 */
  pausedAt: string | null;
  /** 累積中断時間（秒）。 */
  pausedDuration: number;
  /** 記録中の記録（DB 採番済み）。記録していない時は null。 */
  currentRecord: WorkRecord | null;
  /** ボトムシートの展開状態。 */
  sheetVisible: boolean;
  /** 警告モーダルの表示フラグ。 */
  alertPending: boolean;
  /** 警告時の WBGT 値。 */
  alertWbgt: number | null;
  /** 保存済み記録の一覧（新しい順）。 */
  records: WorkRecord[];
  /** 一覧の読み込み中フラグ。 */
  isLoading: boolean;
  /** 次ページの追加読み込み中フラグ。 */
  isLoadingMore: boolean;
  /** さらに古い記録が存在する可能性があるか。 */
  hasMore: boolean;

  /** 記録を開始する（現在地・WBGT を取得して DB に保存）。 */
  startRecording: (input: StartRecordingInput) => Promise<void>;
  /** 記録を終了する（終了 WBGT を取得して確定保存）。 */
  stopRecording: () => Promise<void>;
  /** 一時中断する。 */
  pauseRecording: () => Promise<void>;
  /** 再開する。 */
  resumeRecording: () => Promise<void>;
  /** アラート措置を記録する。 */
  recordAlertMeasures: (measures: string[], action: 'continue' | 'pause') => Promise<void>;
  /** アラートを表示する（外部トリガー）。 */
  triggerAlert: (wbgt: number) => void;
  /** アラートを閉じる。 */
  dismissAlert: () => void;
  /** ボトムシートの表示切替。 */
  toggleSheet: () => void;
  /** ボトムシートを閉じる。 */
  hideSheet: () => void;
  /** 記録中の編集内容（活動種別・人数・措置・メモ）を反映する。 */
  updateCurrentRecord: (patch: RecordDraftPatch) => Promise<void>;
  /** 一覧を先頭から読み込み直す。 */
  loadRecords: () => Promise<void>;
  /** 次ページを追加読み込みする。 */
  loadMoreRecords: () => Promise<void>;
  /** 記録を 1 件削除する。 */
  deleteRecord: (id: number) => Promise<void>;
}

/**
 * 記録中の WBGT 追跡タイマー。
 * state には保持せず、モジュールスコープで管理する。
 */
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** WBGT 追跡ポーリングを停止する。 */
function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export const useRecordStore = create<RecordState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  pausedAt: null,
  pausedDuration: 0,
  currentRecord: null,
  sheetVisible: false,
  alertPending: false,
  alertWbgt: null,
  records: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,

  startRecording: async (input) => {
    if (get().isRecording) return;

    const wbgt = useWbgtStore.getState();

    // 現在地: ストアに無ければ取得する。
    let location = wbgt.location;
    if (!location) {
      const info = await getCurrentLocation();
      location = info;
    }

    // 現在の WBGT: 未取得なら取得を試みる。
    let current = wbgt.current;
    if (!current) {
      await wbgt.fetchWbgt();
      current = useWbgtStore.getState().current;
    }
    const startWbgt = current?.wbgt ?? 0;

    const flavor = getFlavor();
    const draft: NewWorkRecord = {
      startTime: new Date().toISOString(),
      endTime: null,
      latitude: location.latitude,
      longitude: location.longitude,
      placeName: location.placeName ?? '不明な場所',
      startWbgt,
      endWbgt: null,
      maxWbgt: startWbgt,
      dataSource: 'estimated',
      activityType: input.activityType,
      workerCount: input.workerCount,
      measures: [],
      memo: '',
      flavor,
      pausedDuration: 0,
    };

    const id = await insertRecord(draft);
    set({
      isRecording: true,
      isPaused: false,
      pausedAt: null,
      pausedDuration: 0,
      currentRecord: { id, ...draft },
      sheetVisible: false,
    });

    // 5 分ごとに WBGT を再取得し、最大値を更新する。
    stopPolling();
    pollTimer = setInterval(() => {
      void (async () => {
        const state = get();
        if (state.isPaused) return; // 中断中はスキップ
        await useWbgtStore.getState().fetchWbgt();
        const latest = useWbgtStore.getState().current;
        const record = get().currentRecord;
        if (!latest || !record) return;
        if (latest.wbgt > record.maxWbgt) {
          set({ currentRecord: { ...record, maxWbgt: latest.wbgt } });
        }
      })();
    }, RECORDING_POLL_INTERVAL_MS);
  },

  stopRecording: async () => {
    const state = get();
    const record = state.currentRecord;
    if (!record) return;

    stopPolling();

    // 中断中だったら中断時間を加算
    let totalPaused = state.pausedDuration;
    if (state.isPaused && state.pausedAt) {
      const pauseElapsed = Math.floor(
        (Date.now() - new Date(state.pausedAt).getTime()) / 1000,
      );
      totalPaused += pauseElapsed;
    }

    // 終了時の WBGT を取得する。失敗時は最大値を据え置く。
    await useWbgtStore.getState().fetchWbgt();
    const latest = useWbgtStore.getState().current;
    const endWbgt = latest?.wbgt ?? record.startWbgt;
    const maxWbgt = Math.max(record.maxWbgt, endWbgt);

    const finalized: WorkRecord = {
      ...record,
      endTime: new Date().toISOString(),
      endWbgt,
      maxWbgt,
      pausedDuration: totalPaused,
    };

    await updateRecord(record.id, {
      endTime: finalized.endTime,
      endWbgt: finalized.endWbgt,
      maxWbgt: finalized.maxWbgt,
      activityType: finalized.activityType,
      workerCount: finalized.workerCount,
      measures: finalized.measures,
      memo: finalized.memo,
      pausedDuration: finalized.pausedDuration,
    });

    set({
      isRecording: false,
      isPaused: false,
      pausedAt: null,
      pausedDuration: 0,
      currentRecord: null,
      sheetVisible: false,
      alertPending: false,
      alertWbgt: null,
    });
    await get().loadRecords();
  },

  pauseRecording: async () => {
    const record = get().currentRecord;
    if (!record || get().isPaused) return;

    const now = new Date().toISOString();
    set({ isPaused: true, pausedAt: now });

    await insertRecordEvent({
      recordId: record.id,
      eventType: 'pause',
      timestamp: now,
      wbgt: useWbgtStore.getState().current?.wbgt ?? null,
      data: null,
    });
  },

  resumeRecording: async () => {
    const state = get();
    const record = state.currentRecord;
    if (!record || !state.isPaused || !state.pausedAt) return;

    const now = new Date().toISOString();
    const pauseElapsed = Math.floor(
      (Date.now() - new Date(state.pausedAt).getTime()) / 1000,
    );
    const newPausedDuration = state.pausedDuration + pauseElapsed;

    set({
      isPaused: false,
      pausedAt: null,
      pausedDuration: newPausedDuration,
    });

    await insertRecordEvent({
      recordId: record.id,
      eventType: 'resume',
      timestamp: now,
      wbgt: useWbgtStore.getState().current?.wbgt ?? null,
      data: JSON.stringify({ pauseSeconds: pauseElapsed }),
    });

    // DB の pausedDuration を更新
    await updateRecord(record.id, { pausedDuration: newPausedDuration });
  },

  recordAlertMeasures: async (measures, action) => {
    const record = get().currentRecord;
    if (!record) return;

    const now = new Date().toISOString();
    await insertRecordEvent({
      recordId: record.id,
      eventType: 'alert',
      timestamp: now,
      wbgt: get().alertWbgt,
      data: JSON.stringify({ measures, action }),
    });

    // 措置を記録のmeasuresに追加（重複除外）
    const currentMeasures = record.measures;
    const merged = [...new Set([...currentMeasures, ...measures])];
    const updatedRecord = { ...record, measures: merged };
    set({ currentRecord: updatedRecord, alertPending: false, alertWbgt: null });
    await updateRecord(record.id, { measures: merged });

    if (action === 'pause') {
      await get().pauseRecording();
    }
  },

  triggerAlert: (wbgt) => {
    if (!get().isRecording || get().isPaused) return;
    set({ alertPending: true, alertWbgt: wbgt });
  },

  dismissAlert: () => {
    set({ alertPending: false, alertWbgt: null });
  },

  toggleSheet: () => {
    set((state) => ({ sheetVisible: !state.sheetVisible }));
  },

  hideSheet: () => {
    set({ sheetVisible: false });
  },

  updateCurrentRecord: async (patch) => {
    const record = get().currentRecord;
    if (!record) return;

    const next = { ...record, ...patch };
    set({ currentRecord: next });
    await updateRecord(record.id, patch);
  },

  loadRecords: async () => {
    set({ isLoading: true });
    try {
      const rows = await dbGetRecords({ limit: RECORDS_PAGE_SIZE, offset: 0 });
      set({
        records: rows,
        hasMore: rows.length === RECORDS_PAGE_SIZE,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMoreRecords: async () => {
    const { isLoadingMore, hasMore, records } = get();
    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });
    try {
      const rows = await dbGetRecords({
        limit: RECORDS_PAGE_SIZE,
        offset: records.length,
      });
      set({
        records: [...records, ...rows],
        hasMore: rows.length === RECORDS_PAGE_SIZE,
        isLoadingMore: false,
      });
    } catch {
      set({ isLoadingMore: false });
    }
  },

  deleteRecord: async (id) => {
    await dbDeleteRecord(id);
    set((state) => ({ records: state.records.filter((r) => r.id !== id) }));
  },
}));
