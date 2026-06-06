/**
 * 作業/活動記録のエクスポート（CSV / PDF）と共有を提供するサービス。
 *
 * 主に biz（業務）向け。労働基準監督署へ提出する書式に合わせた CSV と、
 * 体裁を整えた PDF レポートを生成し、システムの共有シートで出力する。
 * ファイルは expo-file-system のドキュメントディレクトリに保存する。
 */

import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { WorkRecord } from './database';

/** エクスポート対象の日付範囲。 */
export interface DateRange {
  /** 範囲の開始日。 */
  from: Date;
  /** 範囲の終了日。 */
  to: Date;
}

/** PDF レポートのヘッダーに記載する任意のメタ情報。 */
export interface ExportMetadata {
  /** 会社名（任意）。 */
  companyName?: string;
  /** 現場名（任意）。 */
  siteName?: string;
}

/** CSV / PDF 共通の列見出し（労働基準監督署の書式に準拠）。 */
const COLUMN_HEADERS = [
  '日時',
  '場所',
  'WBGT値(開始)',
  'WBGT値(終了)',
  '最大WBGT値',
  'データソース',
  '作業内容',
  '作業者数',
  '講じた措置',
  '備考',
] as const;

/** データソースの表示文言。 */
const DATA_SOURCE_LABELS: Record<WorkRecord['dataSource'], string> = {
  estimated: '推定',
  manual: '手入力',
};

/** Date を「YYYY/MM/DD HH:mm」表記にする。 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date を「YYYY/MM/DD」表記にする。 */
function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

/** Date を「YYYYMMDD」表記にする（ファイル名用）。 */
function formatDateCompact(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** WBGT 値を「28.5」表記にする（null は空文字）。 */
function formatWbgt(value: number | null): string {
  return value != null ? value.toFixed(1) : '';
}

/** 1 件の記録を CSV / 表の列値（10 列）へ変換する。 */
function recordToCells(record: WorkRecord): string[] {
  const dateTime = record.endTime
    ? `${formatDateTime(record.startTime)}〜${formatDateTime(record.endTime).slice(-5)}`
    : formatDateTime(record.startTime);
  return [
    dateTime,
    record.placeName,
    formatWbgt(record.startWbgt),
    formatWbgt(record.endWbgt),
    formatWbgt(record.maxWbgt),
    DATA_SOURCE_LABELS[record.dataSource],
    record.activityType,
    record.workerCount != null ? String(record.workerCount) : '',
    record.measures.join('、'),
    record.memo,
  ];
}

/** CSV の 1 フィールドをエスケープする（カンマ・引用符・改行を含む場合は囲む）。 */
function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** HTML 特殊文字をエスケープする。 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** アプリ名を取得する（PDF フッター用）。 */
function getAppName(): string {
  return Constants.expoConfig?.name ?? 'WBGT記録';
}

/**
 * 記録を CSV へ書き出してドキュメントディレクトリに保存する。
 *
 * Excel で日本語が文字化けしないよう先頭に BOM を付与する。
 *
 * @param records 出力対象の記録（呼び出し側で範囲内に絞り込み済み）
 * @param dateRange 出力対象の日付範囲（ファイル名に使用）
 * @returns 保存したファイルの URI
 */
export async function exportToCSV(
  records: WorkRecord[],
  dateRange: DateRange,
): Promise<string> {
  const lines = [COLUMN_HEADERS.join(',')];
  for (const record of records) {
    lines.push(recordToCells(record).map(escapeCsv).join(','));
  }
  const csv = `\uFEFF${lines.join('\r\n')}`;

  const fileName = `wbgt_record_${formatDateCompact(dateRange.from)}_${formatDateCompact(dateRange.to)}.csv`;
  const file = new File(Paths.document, fileName);
  file.create({ overwrite: true });
  file.write(csv);
  return file.uri;
}

/** PDF レポートの HTML を組み立てる。 */
function buildReportHtml(
  records: WorkRecord[],
  dateRange: DateRange,
  metadata: ExportMetadata,
): string {
  const rows = records
    .map((record) => {
      const cells = recordToCells(record)
        .map((cell) => `<td>${escapeHtml(cell)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const headerCells = COLUMN_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');

  const companyRow = metadata.companyName
    ? `<div class="meta-row"><span class="meta-label">会社名</span><span class="meta-value">${escapeHtml(metadata.companyName)}</span></div>`
    : '';
  const siteRow = metadata.siteName
    ? `<div class="meta-row"><span class="meta-label">現場名</span><span class="meta-value">${escapeHtml(metadata.siteName)}</span></div>`
    : '';

  const exportedAt = formatDateTime(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Hiragino Sans", "Noto Sans CJK JP", sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 24px; }
  .meta { border: 1px solid #ccc; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
  .meta-row { display: flex; padding: 4px 0; font-size: 13px; }
  .meta-label { width: 96px; color: #666; }
  .meta-value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #1a237e; color: #fff; font-weight: 600; white-space: nowrap; }
  tr:nth-child(even) td { background: #f5f6fa; }
  .empty { text-align: center; color: #999; padding: 32px; font-size: 13px; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between; color: #888; font-size: 11px; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
  <h1>熱中症予防 WBGT記録表</h1>
  <div class="subtitle">対象期間: ${formatDate(dateRange.from)} 〜 ${formatDate(dateRange.to)}</div>
  <div class="meta">
    ${companyRow}
    ${siteRow}
    <div class="meta-row"><span class="meta-label">記録件数</span><span class="meta-value">${records.length} 件</span></div>
  </div>
  ${
    records.length > 0
      ? `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">対象期間内に記録がありません。</div>'
  }
  <div class="footer">
    <span>出力日時: ${exportedAt}</span>
    <span>${escapeHtml(getAppName())}</span>
  </div>
</body>
</html>`;
}

/**
 * 記録を PDF レポートへ書き出す。
 *
 * @param records 出力対象の記録
 * @param dateRange 出力対象の日付範囲
 * @param metadata 会社名・現場名などのメタ情報
 * @returns 生成した PDF ファイルの URI
 */
export async function exportToPDF(
  records: WorkRecord[],
  dateRange: DateRange,
  metadata: ExportMetadata,
): Promise<string> {
  const html = buildReportHtml(records, dateRange, metadata);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * ファイルをシステムの共有シートで開く。
 *
 * @param fileUri 共有するローカルファイルの URI
 */
export async function shareFile(fileUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('この端末では共有機能が利用できません。');
  }
  await Sharing.shareAsync(fileUri);
}
