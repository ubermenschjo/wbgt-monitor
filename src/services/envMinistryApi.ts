/**
 * 環境省「熱中症予防情報サイト」WBGT データ取得クライアント（スクレイピング）。
 *
 * 環境省は公式な REST API を提供していないため、フォールバック前提で実装する:
 *   1. プライマリ: OpenMeteo + 自前の推定式（wbgtCalculator 側で実装済み）。
 *   2. セカンダリ: 最寄りの観測地点の WBGT を本サービスで取得する。
 *
 * 取得元についての注意:
 *   人間向けのグラフページ
 *     https://www.wbgt.env.go.jp/graph_ref_td.php?region=03&prefecture=44&point=44132
 *   は WBGT を「画像グラフ」として描画するため、静的 HTML から数値を確実に
 *   取り出すことはできない。グラフが参照している実データは CSV で配信されており、
 *   そちらを直接取得・解析する方が確実で軽量なため、本サービスは CSV を用いる。
 *     予測 CSV: https://www.wbgt.env.go.jp/prev15WG/dl/yohou_{point}.csv
 *
 * スクレイピング対象のため:
 *   - キャッシュは強めに効かせる（1 時間 TTL）。
 *   - いかなる失敗（ネットワーク・形式変更等）でも例外を投げず null を返し、
 *     呼び出し側が推定値へフォールバックできるようにする。
 */

import { DEFAULT_SETTINGS } from '../utils/constants';
import type { Coordinates } from './weatherApi';

/** 予測 CSV のベース URL。{point} を地点コードに置換して使う。 */
const FORECAST_CSV_BASE = 'https://www.wbgt.env.go.jp/prev15WG/dl';

/** 環境省の観測地点（AMeDAS ベース）。 */
export interface EnvPoint {
  /** 地点コード（CSV / URL で使用）。 */
  code: string;
  /** 地点名（日本語）。 */
  name: string;
  /** 地方区分コード（graph_ref_td.php の region パラメータ）。 */
  region: string;
  /** 都道府県コード（graph_ref_td.php の prefecture パラメータ）。 */
  prefecture: string;
  latitude: number;
  longitude: number;
}

/**
 * 代表的な観測地点の一覧。
 * 全観測地点（約 840 点）を網羅するのは現実的でないため、主要都市に絞り、
 * 最寄り地点を距離で選ぶ。地方をまたいで概ねカバーできるよう配置する。
 */
const ENV_POINTS: EnvPoint[] = [
  { code: '14163', name: '札幌', region: '01', prefecture: '14', latitude: 43.06, longitude: 141.33 },
  { code: '34392', name: '仙台', region: '02', prefecture: '34', latitude: 38.27, longitude: 140.87 },
  { code: '44132', name: '東京', region: '03', prefecture: '44', latitude: 35.69, longitude: 139.7 },
  { code: '46106', name: '横浜', region: '03', prefecture: '46', latitude: 35.44, longitude: 139.65 },
  { code: '51106', name: '名古屋', region: '05', prefecture: '51', latitude: 35.17, longitude: 136.97 },
  { code: '62078', name: '大阪', region: '06', prefecture: '62', latitude: 34.69, longitude: 135.52 },
  { code: '61286', name: '京都', region: '06', prefecture: '61', latitude: 35.01, longitude: 135.73 },
  { code: '67437', name: '広島', region: '06', prefecture: '67', latitude: 34.4, longitude: 132.46 },
  { code: '82182', name: '福岡', region: '07', prefecture: '82', latitude: 33.58, longitude: 130.38 },
  { code: '91197', name: '那覇', region: '08', prefecture: '91', latitude: 26.21, longitude: 127.69 },
];

/** 環境省由来の WBGT 値。 */
export interface EnvMinistryWbgt {
  /** WBGT 値（℃）。 */
  wbgt: number;
  /** 対応時刻（ISO 8601）。 */
  time: string;
  /** 取得元の地点名。 */
  pointName: string;
  /** 取得元の地点コード。 */
  pointCode: string;
  /** 選択した時刻が現在より未来なら true（予測値）、過去なら false（実測寄り）。 */
  isForecast: boolean;
}

interface CacheEntry {
  data: EnvMinistryWbgt | null;
  timestamp: number;
}

/** 地点コードごとの取得結果キャッシュ。 */
const cache = new Map<string, CacheEntry>();

/** 2 点間の距離（km）を Haversine で求める。 */
function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 指定座標に最も近い観測地点を返す。 */
export function findNearestPoint(coords: Coordinates): EnvPoint {
  let nearest = ENV_POINTS[0];
  let minDist = Infinity;
  for (const point of ENV_POINTS) {
    const dist = haversineKm(coords, point);
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }
  return nearest;
}

/** "YYYY/MM/DD HH:mm" 形式の文字列を Date に変換する。失敗時は null。 */
function parseEnvDateTime(value: string): Date | null {
  const m = value.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

/**
 * 環境省の予測 CSV を解析し、現在時刻に最も近い WBGT 値を返す。
 *
 * CSV 形式（予測 yohou_{point}.csv）:
 *   1 行目: `Date,2024/07/30 09:00,2024/07/30 10:00,...`（先頭セル以降が時刻）
 *   2 行目: `{地点コード},280,285,...`（WBGT を 10 倍した整数）
 *
 * @returns 解析できた場合は最寄り時刻の値、できなければ null
 */
function parseForecastCsv(csv: string, point: EnvPoint): EnvMinistryWbgt | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const header = lines[0].split(',');
  // データ行は地点コードで始まる行を採用する（無ければ 2 行目）。
  const dataLine =
    lines.find((line) => line.startsWith(point.code)) ?? lines[1];
  const values = dataLine.split(',');

  const now = Date.now();
  let best: { time: Date; wbgt: number } | null = null;

  // 先頭セルはラベル/地点コードなので 1 から走査する。
  for (let i = 1; i < header.length && i < values.length; i++) {
    const time = parseEnvDateTime(header[i]);
    const raw = Number(values[i]);
    if (!time || !Number.isFinite(raw)) continue;

    // 環境省予測値は WBGT×10 の整数。100 を超える値は 10 で割って℃へ戻す。
    const wbgt = raw > 100 ? raw / 10 : raw;
    const diff = Math.abs(time.getTime() - now);
    if (!best || diff < Math.abs(best.time.getTime() - now)) {
      best = { time, wbgt };
    }
  }

  if (!best) return null;
  return {
    wbgt: Math.round(best.wbgt * 10) / 10,
    time: best.time.toISOString(),
    pointName: point.name,
    pointCode: point.code,
    isForecast: best.time.getTime() > now,
  };
}

/**
 * 指定座標の最寄り観測地点から環境省 WBGT を取得する。
 *
 * 1 時間キャッシュ。取得・解析失敗時は例外を投げず null を返す
 * （呼び出し側で推定値にフォールバックできるようにするため）。
 *
 * @param coords 取得対象の緯度経度
 * @param options.forceRefresh true でキャッシュを無視
 * @returns 環境省 WBGT。取得できない場合は null
 */
export async function fetchEnvMinistryWbgt(
  coords: Coordinates,
  options: { forceRefresh?: boolean } = {},
): Promise<EnvMinistryWbgt | null> {
  const point = findNearestPoint(coords);
  const now = Date.now();

  if (!options.forceRefresh) {
    const cached = cache.get(point.code);
    if (
      cached &&
      now - cached.timestamp < DEFAULT_SETTINGS.envMinistryCacheTtlMs
    ) {
      return cached.data;
    }
  }

  try {
    const url = `${FORECAST_CSV_BASE}/yohou_${point.code}.csv`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`環境省データ取得エラー: HTTP ${response.status}`);
    }
    const csv = await response.text();
    const parsed = parseForecastCsv(csv, point);
    // 解析結果（null 含む）を 1 時間キャッシュし、過剰なスクレイピングを防ぐ。
    cache.set(point.code, { data: parsed, timestamp: Date.now() });
    return parsed;
  } catch {
    // 失敗は許容（推定値にフォールバック）。短時間の再試行抑止のため null をキャッシュ。
    cache.set(point.code, { data: null, timestamp: Date.now() });
    return null;
  }
}

/** 環境省データのキャッシュをすべて削除する（主にテスト用）。 */
export function clearEnvMinistryCache(): void {
  cache.clear();
}
