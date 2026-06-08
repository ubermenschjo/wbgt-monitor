/**
 * 記録一覧画面。
 *
 * 保存済みの作業/活動記録を新しい順に一覧表示する。各項目は日付・時間帯・
 * 所要時間・最大 WBGT（リスク色）・場所を示す。プル更新と無限スクロールに
 * 対応し、タップで詳細へ遷移、長押しで削除（確認あり）する。
 */

import { useCallback, useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { getFlavor, useLabel } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { useSubscriptionGate } from '../hooks/useSubscriptionGate';
import { classifyRiskLevel } from '../services/wbgtCalculator';
import { exportToCSV, shareFile } from '../services/exportService';
import type { WorkRecord } from '../services/database';
import { useRecordStore } from '../stores/recordStore';
import { RISK_LEVEL_COLORS } from '../utils/constants';
import type { RecordStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<RecordStackParamList, 'RecordList'>;

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

/** ISO 8601 を「YYYY/M/D」表記にする。 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** ISO 8601 を「HH:mm」表記にする。 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordScreen() {
  const { gated } = useSubscriptionGate();
  const labels = useLabel();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Navigation>();

  // ゲートされた場合は何もレンダリングしない（Paywall へ遷移済み）
  if (gated) return null;

  const records = useRecordStore((s) => s.records);
  const isLoading = useRecordStore((s) => s.isLoading);
  const isLoadingMore = useRecordStore((s) => s.isLoadingMore);
  const loadRecords = useRecordStore((s) => s.loadRecords);
  const loadMoreRecords = useRecordStore((s) => s.loadMoreRecords);
  const deleteRecord = useRecordStore((s) => s.deleteRecord);

  // 画面にフォーカスが戻るたびに一覧を読み込み直す（記録後の反映）。
  useFocusEffect(
    useCallback(() => {
      void loadRecords();
    }, [loadRecords]),
  );

  // consumer 向けの簡易共有: 読み込み済みのログを CSV にして共有する。
  const handleShare = useCallback(async () => {
    if (records.length === 0) return;
    try {
      const times = records.map((r) => new Date(r.startTime).getTime());
      const from = new Date(Math.min(...times));
      const to = new Date(Math.max(...times));
      const uri = await exportToCSV(records, { from, to });
      await shareFile(uri);
    } catch (e) {
      Alert.alert('共有に失敗しました', e instanceof Error ? e.message : String(e));
    }
  }, [records]);

  // consumer のみ、ヘッダーに共有ボタンを表示する。
  useLayoutEffect(() => {
    if (getFlavor() !== 'consumer') return;
    navigation.setOptions({
      headerRight: () =>
        records.length > 0 ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => void handleShare()}
            accessibilityLabel={labels.shareButton ?? '共有'}
          >
            <Ionicons name="share-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, records.length, handleShare, labels.shareButton, theme.primary]);

  const confirmDelete = (record: WorkRecord) => {
    Alert.alert(
      `${labels.recordSection}の削除`,
      `${formatDate(record.startTime)} の記録を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => void deleteRecord(record.id),
        },
      ],
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12 },
        records.length === 0 && styles.emptyContent,
      ]}
      data={records}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => void loadRecords()}
          tintColor={theme.primary}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => void loadMoreRecords()}
      ListHeaderComponent={
        records.length > 0 ? (
          <Text style={[styles.sectionHeader, { color: theme.text }]}>
            {labels.recordSection}
          </Text>
        ) : null
      }
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator style={styles.footer} color={theme.primary} />
        ) : null
      }
      ListEmptyComponent={
        isLoading ? null : (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              まだ{labels.recordSection}がありません
            </Text>
            <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
              ホーム画面の「{labels.startButton}」から記録を始めましょう。
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const riskColor = RISK_LEVEL_COLORS[classifyRiskLevel(item.maxWbgt)];
        return (
          <TouchableOpacity
            style={[styles.item, { backgroundColor: theme.surface }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('RecordDetail', { id: item.id })}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemDate, { color: theme.text }]}>
                {formatDate(item.startTime)}
              </Text>
              <View style={[styles.wbgtTag, { backgroundColor: riskColor }]}>
                <Text style={styles.wbgtTagText}>
                  最大 {item.maxWbgt.toFixed(1)}℃
                </Text>
              </View>
            </View>
            <Text style={[styles.timeRange, { color: theme.textSecondary }]}>
              {formatTime(item.startTime)}
              {item.endTime ? ` 〜 ${formatTime(item.endTime)}` : ' 〜 （記録中）'}
            </Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {formatDuration(item.startTime, item.endTime)}
              </Text>
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {item.placeName}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingVertical: 16,
  },
  headerButton: {
    paddingHorizontal: 4,
  },
  item: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemDate: {
    fontSize: 16,
    fontWeight: '700',
  },
  wbgtTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  wbgtTagText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  timeRange: {
    fontSize: 14,
    marginTop: 8,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    fontSize: 14,
  },
});
