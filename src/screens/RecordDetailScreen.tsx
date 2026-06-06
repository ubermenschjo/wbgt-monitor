/**
 * 記録詳細画面。
 *
 * 1 件の作業/活動記録の全項目を表示する。OpenStreetMap の静的画像で
 * 実施場所を示し、WBGT（開始・最大・終了）をリスク色付きで並べる。
 * biz は作業者数と講じた措置を業務向けの体裁で、consumer は対策メモを
 * カジュアルな表記で表示する。
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getFlavor, useLabel } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { classifyRiskLevel } from '../services/wbgtCalculator';
import { getRecordById, type WorkRecord } from '../services/database';
import { RISK_LEVEL_COLORS } from '../utils/constants';
import type { RecordStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RecordStackParamList, 'RecordDetail'>;

/** ISO 8601 を「YYYY/M/D（曜）」表記にする。 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${week}）`;
}

/** ISO 8601 を「HH:mm」表記にする。 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 開始・終了の ISO から所要時間を「H時間M分」表記にする。 */
function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '記録中';
  const minutes = Math.max(
    0,
    Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000),
  );
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

/** 静的地図画像（OpenStreetMap）の URL を組み立てる。 */
function buildMapUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: '15',
    size: '600x300',
    markers: `${latitude},${longitude},red-pushpin`,
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`;
}

export default function RecordDetailScreen({ route }: Props) {
  const { id } = route.params;
  const labels = useLabel();
  const theme = useTheme();
  const flavor = getFlavor();

  const [record, setRecord] = useState<WorkRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getRecordById(id);
      if (active) {
        setRecord(result);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.notFound, { color: theme.textSecondary }]}>
          記録が見つかりませんでした
        </Text>
      </View>
    );
  }

  const wbgtItems: { label: string; value: number | null }[] = [
    { label: '開始時', value: record.startWbgt },
    { label: '最大', value: record.maxWbgt },
    { label: '終了時', value: record.endWbgt },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      {/* 日時・所要時間 */}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.dateText, { color: theme.text }]}>
          {formatDate(record.startTime)}
        </Text>
        <Text style={[styles.timeRange, { color: theme.textSecondary }]}>
          {formatTime(record.startTime)}
          {record.endTime ? ` 〜 ${formatTime(record.endTime)}` : ' 〜 （記録中）'}
          {'　'}
          {formatDuration(record.startTime, record.endTime)}
        </Text>
      </View>

      {/* 地図 */}
      <View style={[styles.card, styles.mapCard, { backgroundColor: theme.surface }]}>
        <Image
          source={{ uri: buildMapUrl(record.latitude, record.longitude) }}
          style={styles.map}
          resizeMode="cover"
        />
        <View style={styles.mapCaption}>
          <Text style={[styles.placeName, { color: theme.text }]}>
            {record.placeName}
          </Text>
          <Text style={[styles.coords, { color: theme.textSecondary }]}>
            {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
          </Text>
        </View>
      </View>

      {/* WBGT */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>WBGT</Text>
      <View style={[styles.card, styles.wbgtRow, { backgroundColor: theme.surface }]}>
        {wbgtItems.map((item) => {
          const color =
            item.value != null
              ? RISK_LEVEL_COLORS[classifyRiskLevel(item.value)]
              : theme.textSecondary;
          return (
            <View key={item.label} style={styles.wbgtBox}>
              <Text style={[styles.wbgtLabel, { color: theme.textSecondary }]}>
                {item.label}
              </Text>
              <Text style={[styles.wbgtValue, { color }]}>
                {item.value != null ? `${item.value.toFixed(1)}℃` : '—'}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.sourceNote, { color: theme.textSecondary }]}>
        {record.dataSource === 'manual' ? '手入力値' : '推定値（気象データから算出）'}
      </Text>

      {/* 活動内容 */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {flavor === 'biz' ? '作業内容' : '活動内容'}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <DetailRow
          theme={theme}
          label={flavor === 'biz' ? '作業種別' : '活動種別'}
          value={record.activityType || '（未設定）'}
        />
        {labels.workerCount != null && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <DetailRow
              theme={theme}
              label={labels.workerCount}
              value={record.workerCount != null ? `${record.workerCount} 名` : '—'}
            />
          </>
        )}
      </View>

      {/* 講じた措置 / 対策メモ */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {labels.measureLabel}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        {record.measures.length === 0 ? (
          <Text style={[styles.emptyMeasure, { color: theme.textSecondary }]}>
            記録なし
          </Text>
        ) : flavor === 'biz' ? (
          // biz: 箇条書きで業務向けに列挙する。
          record.measures.map((m) => (
            <View key={m} style={styles.measureItem}>
              <Text style={[styles.bullet, { color: theme.primary }]}>・</Text>
              <Text style={[styles.measureText, { color: theme.text }]}>{m}</Text>
            </View>
          ))
        ) : (
          // consumer: カジュアルな一文にまとめる。
          <Text style={[styles.casualMeasure, { color: theme.text }]}>
            {record.measures.join('、')}しました。
          </Text>
        )}
      </View>

      {/* 自由メモ */}
      {record.memo.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            メモ
          </Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.memoText, { color: theme.text }]}>{record.memo}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** ラベルと値を 1 行で表示する補助コンポーネント。 */
function DetailRow({
  theme,
  label,
  value,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontSize: 15,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
  },
  timeRange: {
    fontSize: 14,
    marginTop: 6,
  },
  mapCard: {
    padding: 0,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: 180,
    backgroundColor: '#dfe3e8',
  },
  mapCaption: {
    padding: 14,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  coords: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  wbgtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wbgtBox: {
    flex: 1,
    alignItems: 'center',
  },
  wbgtLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  wbgtValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  sourceNote: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  measureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  bullet: {
    fontSize: 15,
    fontWeight: '800',
    marginRight: 4,
  },
  measureText: {
    fontSize: 15,
    flex: 1,
  },
  casualMeasure: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyMeasure: {
    fontSize: 14,
  },
  memoText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
