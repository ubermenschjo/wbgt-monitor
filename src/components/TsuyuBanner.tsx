/**
 * 梅雨モード — 湿度・カビリスク警告バナー。
 *
 * HomeScreen のゲージ下に表示し、室内推定湿度・カビリスク・
 * 次の換気推奨タイミングをコンパクトに伝える。
 *
 * 梅雨モードが無効（シーズン外）なら何もレンダリングしない。
 */

import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { TsuyuStatus } from '../services/tsuyuService';

interface TsuyuBannerProps {
  status: TsuyuStatus;
}

/** HH:mm 形式に整形する。 */
function fmtHour(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TsuyuBanner({ status }: TsuyuBannerProps) {
  const theme = useTheme();

  if (!status.isActive) return null;

  const { moldRisk, indoorHumidity, outdoorHumidity, ventilationWindows } = status;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderLeftColor: moldRisk.color,
        },
      ]}
    >
      {/* ヘッダー行: 梅雨モード + リスクバッジ */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>☔ 梅雨モード</Text>
        <View style={[styles.badge, { backgroundColor: moldRisk.color + '20' }]}>
          <Text style={[styles.badgeText, { color: moldRisk.color }]}>
            {moldRisk.emoji} {moldRisk.label}
          </Text>
        </View>
      </View>

      {/* 湿度表示 */}
      <View style={styles.humidityRow}>
        <View style={styles.humidityItem}>
          <Text style={[styles.humidityLabel, { color: theme.textSecondary }]}>
            室内（推定）
          </Text>
          <Text
            style={[
              styles.humidityValue,
              { color: indoorHumidity >= 70 ? moldRisk.color : theme.text },
            ]}
          >
            {indoorHumidity}%
          </Text>
        </View>
        <View style={styles.humidityDivider} />
        <View style={styles.humidityItem}>
          <Text style={[styles.humidityLabel, { color: theme.textSecondary }]}>
            外気
          </Text>
          <Text style={[styles.humidityValue, { color: theme.text }]}>
            {outdoorHumidity}%
          </Text>
        </View>
      </View>

      {/* 換気推奨 */}
      {ventilationWindows.length > 0 && (
        <View style={styles.ventilationRow}>
          <Text style={[styles.ventilationLabel, { color: theme.textSecondary }]}>
            🪟 換気チャンス
          </Text>
          <Text style={[styles.ventilationTime, { color: theme.text }]}>
            {ventilationWindows
              .slice(0, 2)
              .map((w) => `${fmtHour(w.startTime)}〜${fmtHour(w.endTime)}`)
              .join('、')}
          </Text>
        </View>
      )}

      {ventilationWindows.length === 0 && moldRisk.level !== 'low' && (
        <View style={styles.ventilationRow}>
          <Text style={[styles.ventilationLabel, { color: theme.textSecondary }]}>
            🪟 本日は換気に適した時間帯がありません
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 14,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  humidityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  humidityItem: {
    flex: 1,
    alignItems: 'center',
  },
  humidityDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#ddd',
  },
  humidityLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  humidityValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  ventilationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 6,
  },
  ventilationLabel: {
    fontSize: 12,
  },
  ventilationTime: {
    fontSize: 13,
    fontWeight: '600',
  },
});
