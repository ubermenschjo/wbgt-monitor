/**
 * 作業/活動記録の状態管理ストア（zustand）。
 *
 * 記録中の状態（isRecording / currentRecord）と、保存済み記録の一覧
 * （ページネーション対応）を保持する。開始時に現在地と WBGT を取得して
 * 記録を作成し、記録中は 5 分ごとに WBGT を再取得して最大値を追跡する。
 * 終了時に終了 WBGT・所要時間を確定して保存する。
 */

import { create } from 'zustand';

import {
  type NewWorkRecord,
  type WorkRecord,
  deleteRecord as dbDeleteRecord,
  getRecords as dbGetRecords,
  insertRecord,
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

interface RecordState {
  /** 記録中かどうか。 */
  isRecording: boolean;
  /** 記録中の記録（DB 採番済み）。記録していない時は null。 */
  currentRecord: WorkRecord | null;
  /** 保存済み記録の一覧（新しい順）。 */
  records: WorkRecord[];
  /** 一覧の読み込み中フラグ。 */
  isLoading: boolean;
  /** 次ページの追加読み込み中フラグ。 */
  isLoadingMore: boolean;
  /** さらに古い記録が存在する可能性があるか。 */
  hasMore: boolean;

  /** 記録を開始する（現在地・WBGT を取得して DB に保存）。 */
  startRecording: () => Promise<void>;
  /** 記録を終了する（終了 WBGT を取得して確定保存）。 */
  stopRecording: () => Promise<void>;
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
  currentRecord: null,
  records: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,

  startRecording: async () => {
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
      activityType: '',
      workerCount: null,
      measures: [],
      memo: '',
      flavor,
    };

    const id = await insertRecord(draft);
    set({ isRecording: true, currentRecord: { id, ...draft } });

    // 5 分ごとに WBGT を再取得し、最大値を更新する。
    stopPolling();
    pollTimer = setInterval(() => {
      void (async () => {
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
    const record = get().currentRecord;
    if (!record) return;

    stopPolling();

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
    };

    await updateRecord(record.id, {
      endTime: finalized.endTime,
      endWbgt: finalized.endWbgt,
      maxWbgt: finalized.maxWbgt,
      activityType: finalized.activityType,
      workerCount: finalized.workerCount,
      measures: finalized.measures,
      memo: finalized.memo,
    });

    set({ isRecording: false, currentRecord: null });
    await get().loadRecords();
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
