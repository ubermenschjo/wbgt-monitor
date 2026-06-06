/**
 * 24 時間 WBGT 予報の横スクロール棒グラフ。
 *
 * 各時間の WBGT 値をリスクレベル色の棒で表し、時刻ラベルを下に表示する。
 * 先頭（現在の時間）はハイライトする。
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { HourlyForecast } from '../services/wbgtCalculator';

/** 棒の最大の高さ（px）。 */
const MAX_BAR_HEIGHT = 120;
/** グラフのスケール上限（℃）。 */
const SCALE_MAX = 40;
/** 各棒の幅（px）。 */
const BAR_WIDTH = 40;

interface HourlyChartProps {
  /** 次の 24 時間分の予報。先頭が現在の時間。 */
  data: HourlyForecast[];
}

/** ISO 8601 文字列から「H時」表記の時刻ラベルを作る。 */
function formatHour(iso: string): string {
  const hour = new Date(iso).getHours();
  return `${hour}時`;
}

export default function HourlyChart({ data }: HourlyChartProps) {
  const theme = useTheme();

  if (data.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {data.map((item, index) => {
        const isCurrent = index === 0;
        const ratio = Math.min(Math.max(item.wbgt, 0) / SCALE_MAX, 1);
        const barHeight = Math.max(ratio * MAX_BAR_HEIGHT, 6);

        return (
          <View key={item.time} style={styles.column}>
            <Text style={[styles.valueLabel, { color: theme.textSecondary }]}>
              {item.wbgt.toFixed(0)}
            </Text>
            <View style={[styles.track, { height: MAX_BAR_HEIGHT }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: item.riskColor,
                    borderWidth: isCurrent ? 2 : 0,
                    borderColor: theme.text,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.hourLabel,
                {
                  color: isCurrent ? theme.primary : theme.textSecondary,
                  fontWeight: isCurrent ? '700' : '500',
                },
              ]}
            >
              {isCurrent ? '今' : formatHour(item.time)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  column: {
    width: BAR_WIDTH,
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  track: {
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    borderRadius: 6,
  },
  hourLabel: {
    fontSize: 11,
    marginTop: 6,
  },
});
