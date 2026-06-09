/**
 * ホーム画面。
 *
 * 現在の WBGT をゲージで大きく表示し、地名・最終更新時刻・24 時間予報・
 * 作業/外出の開始ボタンをまとめる。プル更新・読み込み中スケルトン・
 * エラー時の再試行に対応する。
 *
 * v2: 作業開始モーダル + FloatingBar + AlertAction + RecordingSheet 統合。
 */

import { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DataSourceBadge from '../components/DataSourceBadge';
import HourlyChart from '../components/HourlyChart';
import StartRecordingModal from '../components/StartRecordingModal';
import TsuyuBanner from '../components/TsuyuBanner';
import WbgtGauge from '../components/WbgtGauge';
import { useLabel } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { classifyRiskLevel } from '../services/wbgtCalculator';
import { useRecordStore } from '../stores/recordStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWbgtStore } from '../stores/wbgtStore';

/** epoch ミリ秒を「HH:mm」表記に整形する。 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomeScreen() {
  const labels = useLabel();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const current = useWbgtStore((s) => s.current);
  const location = useWbgtStore((s) => s.location);
  const hourlyForecast = useWbgtStore((s) => s.hourlyForecast);
  const sunEvents = useWbgtStore((s) => s.sunEvents);
  const envMinistryWbgt = useWbgtStore((s) => s.envMinistryWbgt);
  const tsuyuStatus = useWbgtStore((s) => s.tsuyuStatus);
  const isLoading = useWbgtStore((s) => s.isLoading);
  const error = useWbgtStore((s) => s.error);
  const lastUpdated = useWbgtStore((s) => s.lastUpdated);
  const fetchWbgt = useWbgtStore((s) => s.fetchWbgt);
  const startAutoRefresh = useWbgtStore((s) => s.startAutoRefresh);

  const wbgtThreshold = useSettingsStore((s) => s.wbgtThreshold);

  // 記録状態
  const isRecording = useRecordStore((s) => s.isRecording);
  const startRecording = useRecordStore((s) => s.startRecording);

  // 作業開始モーダル
  const [showStartModal, setShowStartModal] = useState(false);

  useEffect(() => {
    void fetchWbgt();
    const stop = startAutoRefresh();
    return stop;
  }, [fetchWbgt, startAutoRefresh]);

  // エラーかつデータ未取得: 再試行ボタン付きのエラー表示。
  if (error && !current) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: theme.background, paddingTop: insets.top },
        ]}
      >
        <Text style={[styles.errorTitle, { color: theme.text }]}>
          データを取得できませんでした
        </Text>
        <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={() => void fetchWbgt()}
        >
          <Text style={styles.retryText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // データ未取得かつ読み込み中: スケルトン表示。
  if (!current) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, paddingTop: insets.top + 16 },
        ]}
      >
        <View style={[styles.skeletonCircle, { backgroundColor: theme.border }]} />
        <View
          style={[styles.skeletonLine, { backgroundColor: theme.border, width: 160 }]}
        />
        <View
          style={[styles.skeletonLine, { backgroundColor: theme.border, width: 220 }]}
        />
        <View
          style={[
            styles.skeletonBlock,
            { backgroundColor: theme.border, marginTop: 24 },
          ]}
        />
      </View>
    );
  }

  // 環境省データがあれば推定値より優先してゲージに表示する。
  const displayValue = envMinistryWbgt?.wbgt ?? current.wbgt;
  const displayRiskLevel = envMinistryWbgt
    ? classifyRiskLevel(envMinistryWbgt.wbgt)
    : current.riskLevel;

  const handleStartPress = () => {
    if (isRecording) return; // すでに記録中は無視
    setShowStartModal(true);
  };

  const handleStartConfirm = (activityType: string, workerCount: number | null) => {
    setShowStartModal(false);
    void startRecording({ activityType, workerCount });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void fetchWbgt()}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.locationRow}>
          <Text style={[styles.locationName, { color: theme.text }]}>
            {location?.placeName ?? '位置情報を取得中'}
          </Text>
          {lastUpdated != null && (
            <Text style={[styles.updatedAt, { color: theme.textSecondary }]}>
              {formatTime(lastUpdated)} 更新
            </Text>
          )}
        </View>

        <WbgtGauge value={displayValue} riskLevel={displayRiskLevel} />

        <DataSourceBadge
          source={envMinistryWbgt ? 'ministry' : 'estimated'}
          detail={envMinistryWbgt ? envMinistryWbgt.pointName : undefined}
        />

        {envMinistryWbgt && (
          <Text style={[styles.comparisonText, { color: theme.textSecondary }]}>
            推定値 {current.wbgt.toFixed(1)}℃ ／ 環境省{' '}
            {envMinistryWbgt.isForecast ? '予測' : '実測'} {envMinistryWbgt.wbgt.toFixed(1)}℃
          </Text>
        )}

        {/* 梅雨モードバナー */}
        {tsuyuStatus && <TsuyuBanner status={tsuyuStatus} />}

        {/* 記録中でなければ開始ボタンを表示 */}
        {!isRecording && (
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.85}
            onPress={handleStartPress}
          >
            <Text style={[styles.startButtonText, { color: theme.onPrimary }]}>
              {labels.startButton}
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            今日・明日の予報
          </Text>
          <HourlyChart
            data={hourlyForecast}
            threshold={wbgtThreshold}
            sunEvents={sunEvents}
          />
        </View>
      </ScrollView>

      {/* 作業開始モーダル */}
      <StartRecordingModal
        visible={showStartModal}
        onStart={handleStartConfirm}
        onCancel={() => setShowStartModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120, // FloatingBar の余白
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  locationRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 20,
    fontWeight: '700',
  },
  updatedAt: {
    fontSize: 13,
  },
  comparisonText: {
    fontSize: 12,
    marginTop: 6,
  },
  startButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  skeletonCircle: {
    width: 220,
    height: 110,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 110,
    marginBottom: 24,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  skeletonBlock: {
    width: '100%',
    height: 140,
    borderRadius: 16,
  },
});
