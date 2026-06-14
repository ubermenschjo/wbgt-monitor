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
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DataSourceBadge from '../components/DataSourceBadge';
import HourlyChart from '../components/HourlyChart';
import StartRecordingModal from '../components/StartRecordingModal';
import TsuyuBanner from '../components/TsuyuBanner';
import WbgtGauge from '../components/WbgtGauge';
import { getFlavor, useLabel } from '../hooks/useLabel';
import { useRequireSubscription } from '../hooks/useSubscriptionGate';
import { useTheme } from '../hooks/useTheme';
import { classifyRiskLevel } from '../services/wbgtCalculator';
import { useRecordStore } from '../stores/recordStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useWbgtStore } from '../stores/wbgtStore';

/** epoch ミリ秒を「HH:mm」表記に整形する。 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface SkeletonProps {
  color: string;
}

/** 汎用スケルトンライン。 */
function SkeletonLine({
  color,
  width = '100%',
}: SkeletonProps & { width?: number | `${number}%` }) {
  return (
    <View style={[styles.skeletonLine, { backgroundColor: color, width }]} />
  );
}

/** WBGT ゲージ領域のスケルトン。 */
function GaugeSkeleton({ color }: SkeletonProps) {
  return (
    <View style={styles.gaugeSkeleton}>
      <View
        style={[styles.skeletonCircle, { backgroundColor: color }]}
      />
      <SkeletonLine color={color} width={80} />
    </View>
  );
}

/** 予報グラフ領域のスケルトン。 */
function ChartSkeleton({ color }: SkeletonProps) {
  return (
    <View style={styles.chartSkeleton}>
      <View style={styles.chartSkeletonBars}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.chartSkeletonBar,
              { backgroundColor: color, height: 40 + (i % 3) * 20 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const labels = useLabel();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const requireSubscription = useRequireSubscription();

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
  const subscriptionActive = useSubscriptionStore((s) => s.isActive);
  const subscriptionLoading = useSubscriptionStore((s) => s.loading);
  const isBiz = getFlavor() === 'biz';
  const showSubscriptionBanner =
    isBiz && !subscriptionActive && !subscriptionLoading;

  const isRecording = useRecordStore((s) => s.isRecording);
  const startRecording = useRecordStore((s) => s.startRecording);

  const [showStartModal, setShowStartModal] = useState(false);

  const hasCurrent = current != null;
  const hasForecast = hourlyForecast.length > 0;
  const isInitialLoading = isLoading && !hasCurrent;

  useEffect(() => {
    if (!hasCurrent) {
      void fetchWbgt();
    }
    const stop = startAutoRefresh();
    return stop;
  }, [fetchWbgt, startAutoRefresh, hasCurrent]);

  const handleOpenPaywall = () => {
    navigation.navigate('Paywall');
  };

  const handleStartPress = () => {
    if (isRecording) return;
    if (!requireSubscription()) return;
    setShowStartModal(true);
  };

  const handleStartConfirm = (activityType: string, workerCount: number | null) => {
    setShowStartModal(false);
    void startRecording({ activityType, workerCount });
  };

  const displayValue = envMinistryWbgt?.wbgt ?? current?.wbgt ?? 0;
  const displayRiskLevel = envMinistryWbgt
    ? classifyRiskLevel(envMinistryWbgt.wbgt)
    : current?.riskLevel ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && hasCurrent}
            onRefresh={() => void fetchWbgt()}
            tintColor={theme.primary}
          />
        }
      >
        {/* 地名 — 取得済みなら即表示 */}
        <View style={styles.locationRow}>
          {location?.placeName ? (
            <Text style={[styles.locationName, { color: theme.text }]}>
              {location.placeName}
            </Text>
          ) : (
            <SkeletonLine color={theme.border} width={160} />
          )}
          {lastUpdated != null && (
            <Text style={[styles.updatedAt, { color: theme.textSecondary }]}>
              {formatTime(lastUpdated)} 更新
            </Text>
          )}
        </View>

        {/* 読み込み状態バー */}
        {isInitialLoading && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.loadingBannerText, { color: theme.textSecondary }]}>
              データを読み込み中…
            </Text>
          </View>
        )}

        {/* WBGT ゲージ — 取得済みなら即表示、未取得ならスケルトン */}
        {hasCurrent ? (
          <>
            <WbgtGauge value={displayValue} riskLevel={displayRiskLevel} />
            <DataSourceBadge
              source={envMinistryWbgt ? 'ministry' : 'estimated'}
              detail={envMinistryWbgt ? envMinistryWbgt.pointName : undefined}
            />
            {envMinistryWbgt && (
              <Text style={[styles.comparisonText, { color: theme.textSecondary }]}>
                推定値 {current.wbgt.toFixed(1)}℃ ／ 環境省{' '}
                {envMinistryWbgt.isForecast ? '予測' : '実測'}{' '}
                {envMinistryWbgt.wbgt.toFixed(1)}℃
              </Text>
            )}
          </>
        ) : error ? (
          <View style={styles.errorSection}>
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
        ) : (
          <GaugeSkeleton color={theme.border} />
        )}

        {tsuyuStatus && <TsuyuBanner status={tsuyuStatus} />}

        {showSubscriptionBanner && hasCurrent && (
          <TouchableOpacity
            style={[styles.subscriptionBanner, { backgroundColor: theme.surface }]}
            onPress={handleOpenPaywall}
            activeOpacity={0.8}
          >
            <Text style={[styles.subscriptionBannerText, { color: theme.text }]}>
              作業記録・書き出しはライトプランでご利用いただけます
            </Text>
          </TouchableOpacity>
        )}

        {!isRecording && (
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: theme.primary },
              !hasCurrent && styles.startButtonDisabled,
            ]}
            activeOpacity={0.85}
            onPress={handleStartPress}
            disabled={!hasCurrent}
          >
            <Text style={[styles.startButtonText, { color: theme.onPrimary }]}>
              {showSubscriptionBanner
                ? `${labels.startButton}（Pro）`
                : labels.startButton}
            </Text>
          </TouchableOpacity>
        )}

        {/* 予報 — タイトルは常に表示、グラフは準備でき次第表示 */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            今日・明日の予報
          </Text>
          {hasForecast ? (
            <HourlyChart
              data={hourlyForecast}
              threshold={wbgtThreshold}
              sunEvents={sunEvents}
            />
          ) : isInitialLoading ? (
            <ChartSkeleton color={theme.border} />
          ) : error ? null : (
            <View style={styles.chartEmpty}>
              <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>
                予報データがありません
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <StartRecordingModal
        visible={showStartModal}
        onStart={handleStartConfirm}
        onCancel={() => setShowStartModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    alignItems: 'center',
  },
  locationRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
    minHeight: 28,
  },
  locationName: {
    fontSize: 20,
    fontWeight: '700',
  },
  updatedAt: {
    fontSize: 13,
  },
  loadingBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 4,
  },
  loadingBannerText: {
    fontSize: 14,
  },
  gaugeSkeleton: {
    alignItems: 'center',
    marginBottom: 8,
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
  startButtonDisabled: {
    opacity: 0.5,
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
  errorSection: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
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
    marginBottom: 16,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
  },
  chartSkeleton: {
    width: '100%',
    paddingVertical: 8,
  },
  chartSkeletonBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 120,
  },
  chartSkeletonBar: {
    width: 18,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  chartEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 14,
  },
  subscriptionBanner: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  subscriptionBannerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
