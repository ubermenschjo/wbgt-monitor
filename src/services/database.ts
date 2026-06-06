/**
 * 作業/活動記録の永続化レイヤー（expo-sqlite）。
 *
 * SQLite データベース 'wbgt_records.db' を初期化し、'records' テーブルに対する
 * CRUD 操作（挿入・更新・取得・削除）を提供する。
 * measures は JSON 文字列として保存し、ドメイン型では配列として扱う。
 */

import * as SQLite from 'expo-sqlite';

/** WBGT のデータソース。'estimated'=気象データから推定, 'manual'=手入力。 */
export type DataSource = 'estimated' | 'manual';

/** アプリのフレーバー。'biz'=業務向け, 'consumer'=一般向け。 */
export type RecordFlavor = 'biz' | 'consumer';

/** 1 件の作業/活動記録（ドメイン型）。 */
export interface WorkRecord {
  /** 主キー。 */
  id: number;
  /** 開始時刻（ISO 8601）。 */
  startTime: string;
  /** 終了時刻（ISO 8601）。記録中は null。 */
  endTime: string | null;
  /** 実施場所の緯度。 */
  latitude: number;
  /** 実施場所の経度。 */
  longitude: number;
  /** 実施場所の地名。 */
  placeName: string;
  /** 開始時の WBGT（℃）。 */
  startWbgt: number;
  /** 終了時の WBGT（℃）。記録中は null。 */
  endWbgt: number | null;
  /** 期間中の最大 WBGT（℃）。 */
  maxWbgt: number;
  /** WBGT のデータソース。 */
  dataSource: DataSource;
  /** 作業/活動の種別。 */
  activityType: string;
  /** 作業者数（biz のみ。consumer は null）。 */
  workerCount: number | null;
  /** 講じた措置/対策メモ（選択値の配列）。 */
  measures: string[];
  /** 自由記述メモ。 */
  memo: string;
  /** 記録を作成したフレーバー。 */
  flavor: RecordFlavor;
}

/** 新規挿入用の入力（id は自動採番）。 */
export type NewWorkRecord = Omit<WorkRecord, 'id'>;

/** getRecords のオプション（ページネーションと日付範囲フィルタ）。 */
export interface GetRecordsOptions {
  /** 取得件数の上限。既定 20。 */
  limit?: number;
  /** スキップ件数（ページネーション）。既定 0。 */
  offset?: number;
  /** この日時（ISO 8601）以降の記録に絞り込む。 */
  startDate?: string;
  /** この日時（ISO 8601）以前の記録に絞り込む。 */
  endDate?: string;
}

/** DB の行表現（measures は JSON 文字列）。 */
interface RecordRow {
  id: number;
  startTime: string;
  endTime: string | null;
  latitude: number;
  longitude: number;
  placeName: string;
  startWbgt: number;
  endWbgt: number | null;
  maxWbgt: number;
  dataSource: string;
  activityType: string;
  workerCount: number | null;
  measures: string;
  memo: string;
  flavor: string;
}

const DATABASE_NAME = 'wbgt_records.db';

/** シングルトンの DB 接続。初回 getDatabase 呼び出しで初期化する。 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * DB 接続を取得する（初回はテーブルも作成）。
 * 以降は同一の接続を再利用する。
 */
function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

/** データベースを開いて 'records'・'settings' テーブルを作成する。 */
async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      startTime TEXT NOT NULL,
      endTime TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      placeName TEXT NOT NULL,
      startWbgt REAL NOT NULL,
      endWbgt REAL,
      maxWbgt REAL NOT NULL,
      dataSource TEXT NOT NULL,
      activityType TEXT NOT NULL,
      workerCount INTEGER,
      measures TEXT NOT NULL,
      memo TEXT NOT NULL,
      flavor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

/**
 * データベースを初期化する（アプリ起動時に呼び出す）。
 * テーブルの作成を含む初回接続を確立する。
 */
export async function setupDatabase(): Promise<void> {
  await getDatabase();
}

/** DB 行をドメイン型へ変換する（measures を JSON パース）。 */
function rowToRecord(row: RecordRow): WorkRecord {
  let measures: string[] = [];
  try {
    const parsed = JSON.parse(row.measures);
    if (Array.isArray(parsed)) {
      measures = parsed.filter((m): m is string => typeof m === 'string');
    }
  } catch {
    measures = [];
  }

  return {
    id: row.id,
    startTime: row.startTime,
    endTime: row.endTime,
    latitude: row.latitude,
    longitude: row.longitude,
    placeName: row.placeName,
    startWbgt: row.startWbgt,
    endWbgt: row.endWbgt,
    maxWbgt: row.maxWbgt,
    dataSource: row.dataSource === 'manual' ? 'manual' : 'estimated',
    activityType: row.activityType,
    workerCount: row.workerCount,
    measures,
    memo: row.memo,
    flavor: row.flavor === 'consumer' ? 'consumer' : 'biz',
  };
}

/**
 * 新しい記録を挿入する。
 *
 * @param record 挿入する記録（id を除く）
 * @returns 採番された id
 */
export async function insertRecord(record: NewWorkRecord): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO records (
      startTime, endTime, latitude, longitude, placeName,
      startWbgt, endWbgt, maxWbgt, dataSource, activityType,
      workerCount, measures, memo, flavor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.startTime,
      record.endTime,
      record.latitude,
      record.longitude,
      record.placeName,
      record.startWbgt,
      record.endWbgt,
      record.maxWbgt,
      record.dataSource,
      record.activityType,
      record.workerCount,
      JSON.stringify(record.measures),
      record.memo,
      record.flavor,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * 既存の記録を部分更新する。
 *
 * @param id 更新対象の id
 * @param patch 更新するフィールド（指定したものだけ更新）
 */
export async function updateRecord(
  id: number,
  patch: Partial<NewWorkRecord>,
): Promise<void> {
  const columns: string[] = [];
  const values: SQLite.SQLiteBindValue[] = [];

  // measures は JSON 文字列に変換、その他はそのまま積む。
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    columns.push(`${key} = ?`);
    if (key === 'measures') {
      values.push(JSON.stringify(value));
    } else {
      values.push(value as SQLite.SQLiteBindValue);
    }
  }

  if (columns.length === 0) return;

  const db = await getDatabase();
  values.push(id);
  await db.runAsync(
    `UPDATE records SET ${columns.join(', ')} WHERE id = ?`,
    values,
  );
}

/**
 * 記録の一覧を取得する（新しい順）。
 * ページネーションと日付範囲フィルタに対応する。
 *
 * @param options 取得オプション
 * @returns 記録の配列
 */
export async function getRecords(
  options: GetRecordsOptions = {},
): Promise<WorkRecord[]> {
  const { limit = 20, offset = 0, startDate, endDate } = options;

  const conditions: string[] = [];
  const params: SQLite.SQLiteBindValue[] = [];

  if (startDate) {
    conditions.push('startTime >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('startTime <= ?');
    params.push(endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const db = await getDatabase();
  params.push(limit, offset);
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT * FROM records ${where} ORDER BY startTime DESC LIMIT ? OFFSET ?`,
    params,
  );
  return rows.map(rowToRecord);
}

/**
 * id を指定して 1 件の記録を取得する。
 *
 * @param id 取得対象の id
 * @returns 記録。存在しなければ null
 */
export async function getRecordById(id: number): Promise<WorkRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RecordRow>(
    'SELECT * FROM records WHERE id = ?',
    [id],
  );
  return row ? rowToRecord(row) : null;
}

/**
 * 記録を削除する。
 *
 * @param id 削除対象の id
 */
export async function deleteRecord(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM records WHERE id = ?', [id]);
}

/**
 * 'settings' テーブルの全エントリを取得する。
 *
 * @returns key→value のマップ（値は文字列で保存されている）
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings',
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * 'settings' テーブルに 1 件の設定値を保存する（存在すれば上書き）。
 *
 * @param key 設定キー
 * @param value 設定値（文字列に変換して保存する）
 */
export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/** オンボーディング完了フラグを保持する 'settings' のキー。 */
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

/**
 * オンボーディングが完了済みかどうかを取得する。
 *
 * @returns 完了していれば true（未設定・読み込み失敗時は false）
 */
export async function getOnboardingCompleted(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [ONBOARDING_COMPLETED_KEY],
    );
    return row?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * オンボーディングの完了状態を保存する。
 *
 * @param completed 完了したかどうか
 */
export async function setOnboardingCompleted(completed: boolean): Promise<void> {
  await saveSetting(ONBOARDING_COMPLETED_KEY, String(completed));
}
