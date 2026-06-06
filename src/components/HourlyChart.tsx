/**
 * 今日・明日（48 時間）の WBGT 予報を表す横スクロール棒グラフ。
 *
 * 各時間の WBGT 値をリスクレベル色のグラデーション棒（上部丸め）で表す。
 * - グラフ上部に当日・翌日の最低/最高 WBGT を要約表示する。
 * - 通知しきい値に水平の基準線を引く。
 * - 日の出・日の入りのマーカーを該当時間に表示する。
 * - 棒をタップすると正確な値と時刻をツールチップで表示する。
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import type { HourlyForecast } from '../services/wbgtCalculator';
import type { SunEvent } from '../stores/wbgtStore';

/** 棒の最大の高さ（px）。 */
const MAX_BAR_HEIGHT = 120;
/** グラフのスケール上限（℃）。 */
const SCALE_MAX = 40;
/** 各列の幅（px）。 */
const BAR_WIDTH = 40;
/** 棒本体の幅（px）。 */
const BAR_INNER_WIDTH = 18;
/** 値ラベル行の高さ（px）。 */
const VALUE_LABEL_H = 16;
/** マーカー行（日の出/日の入り）の高さ（px）。 */
const MARKER_H = 16;
/** 時刻ラベル行の高さ（px）。 */
const HOUR_LABEL_H = 18;

interface HourlyChartProps {
  /** 今日・明日（最大 48 時間）分の予報。先頭が現在の時間。 */
  data: HourlyForecast[];
  /** 通知しきい値（℃）。基準線として描画する。 */
  threshold: number;
  /** 予報期間内の日の出・日の入りイベント。 */
  sunEvents?: SunEvent[];
}

/** ISO 8601 文字列から「H時」表記の時刻ラベルを作る。 */
function formatHour(iso: string): string {
  return `${new Date(iso).getHours()}時`;
}

/** ISO 8601 文字列から「M/D H時」表記を作る（ツールチップ用）。 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}時`;
}

/** 同一カレンダー日かを判定するためのキー（YYYY-M-D）。 */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** HEX 色を白方向に混ぜて明るくする（0=元色, 1=白）。 */
function lighten(hex: string, amount: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** 値（℃）を棒の高さ（px）に変換する。 */
function valueToHeight(value: number): number {
  const ratio = Math.min(Math.max(value, 0) / SCALE_MAX, 1);
  return Math.max(ratio * MAX_BAR_HEIGHT, 6);
}

/** 上部を丸めた棒の SVG パスを生成する。 */
function barPath(barHeight: number): string {
  const x = (BAR_WIDTH - BAR_INNER_WIDTH) / 2;
  const w = BAR_INNER_WIDTH;
  const topY = MAX_BAR_HEIGHT - barHeight;
  const r = Math.min(6, barHeight / 2);
  return [
    `M ${x} ${MAX_BAR_HEIGHT}`,
    `L ${x} ${topY + r}`,
    `Q ${x} ${topY} ${x + r} ${topY}`,
    `L ${x + w - r} ${topY}`,
    `Q ${x + w} ${topY} ${x + w} ${topY + r}`,
    `L ${x + w} ${MAX_BAR_HEIGHT}`,
    'Z',
  ].join(' ');
}

/** 各時間（バー）に対応する日の出/日の入り種別を求める。無ければ null。 */
function sunTypeForHour(
  iso: string,
  sunEvents: SunEvent[],
): SunEvent['type'] | null {
  const start = new Date(iso).getTime();
  const end = start + 60 * 60 * 1000;
  const event = sunEvents.find((e) => {
    const t = new Date(e.time).getTime();
    return t >= start && t < end;
  });
  return event?.type ?? null;
}

/** 1 日分の最低/最高 WBGT を求める。 */
function dayRange(items: HourlyForecast[]): { min: number; max: number } | null {
  if (items.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    if (item.wbgt < min) min = item.wbgt;
    if (item.wbgt > max) max = item.wbgt;
  }
  return { min, max };
}

export default function HourlyChart({
  data,
  threshold,
  sunEvents = [],
}: HourlyChartProps) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return null;
  }

  const contentWidth = data.length * BAR_WIDTH;
  const firstDay = dayKey(data[0].time);
  const todayItems = data.filter((d) => dayKey(d.time) === firstDay);
  const tomorrowItems = data.filter((d) => dayKey(d.time) !== firstDay);
  const todayRange = dayRange(todayItems);
  const tomorrowRange = dayRange(tomorrowItems);

  // しきい値の基準線の縦位置（トラック内・上端からの距離）。
  const thresholdHeight = valueToHeight(threshold);
  const thresholdTop = VALUE_LABEL_H + (MAX_BAR_HEIGHT - thresholdHeight);

  // 「明日」境界（最初に日付が変わるバーの位置）。
  const tomorrowIndex = data.findIndex((d) => dayKey(d.time) !== firstDay);

  const selected = selectedIndex != null ? data[selectedIndex] : null;

  return (
    <View>
      <View style={styles.summaryRow}>
        {todayRange && (
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            今日{' '}
            <Text style={[styles.summaryStrong, { color: theme.text }]}>
              {todayRange.min.toFixed(0)}〜{todayRange.max.toFixed(0)}℃
            </Text>
          </Text>
        )}
        {tomorrowRange && (
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            明日{' '}
            <Text style={[styles.summaryStrong, { color: theme.text }]}>
              {tomorrowRange.min.toFixed(0)}〜{tomorrowRange.max.toFixed(0)}℃
            </Text>
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={{ width: contentWidth }}>
          {/* ツールチップ（選択中のバーの真上に表示）。 */}
          {selected && selectedIndex != null && (
            <View
              pointerEvents="none"
              style={[
                styles.tooltip,
                {
                  backgroundColor: theme.text,
                  left: Math.min(
                    Math.max(selectedIndex * BAR_WIDTH + BAR_WIDTH / 2 - 55, 0),
                    Math.max(contentWidth - 110, 0),
                  ),
                },
              ]}
            >
              <Text style={[styles.tooltipValue, { color: theme.background }]}>
                {selected.wbgt.toFixed(1)}℃・{selected.riskLabel}
              </Text>
              <Text style={[styles.tooltipTime, { color: theme.background }]}>
                {formatDateTime(selected.time)}
              </Text>
            </View>
          )}

          <View style={styles.barsRow}>
            {data.map((item, index) => {
              const isCurrent = index === 0;
              const isSelected = index === selectedIndex;
              const barHeight = valueToHeight(item.wbgt);
              const sunType = sunTypeForHour(item.time, sunEvents);
              const gradientId = `bar-grad-${index}`;

              return (
                <Pressable
                  key={item.time}
                  style={styles.column}
                  onPress={() =>
                    setSelectedIndex((prev) => (prev === index ? null : index))
                  }
                >
                  <Text
                    style={[styles.valueLabel, { color: theme.textSecondary }]}
                  >
                    {item.wbgt.toFixed(0)}
                  </Text>

                  <Svg width={BAR_WIDTH} height={MAX_BAR_HEIGHT}>
                    <Defs>
                      <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <Stop
                          offset="0"
                          stopColor={lighten(item.riskColor, 0.4)}
                        />
                        <Stop offset="1" stopColor={item.riskColor} />
                      </LinearGradient>
                    </Defs>
                    <Path
                      d={barPath(barHeight)}
                      fill={`url(#${gradientId})`}
                      stroke={isCurrent || isSelected ? theme.text : 'none'}
                      strokeWidth={isCurrent || isSelected ? 2 : 0}
                    />
                  </Svg>

                  <View style={styles.markerRow}>
                    {sunType === 'sunrise' && (
                      <Ionicons name="sunny" size={13} color="#FB8C00" />
                    )}
                    {sunType === 'sunset' && (
                      <Ionicons name="moon" size={12} color="#5C6BC0" />
                    )}
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
                </Pressable>
              );
            })}
          </View>

          {/* 通知しきい値の水平基準線。 */}
          <View
            pointerEvents="none"
            style={[styles.thresholdLine, { top: thresholdTop, width: contentWidth }]}
          >
            <View style={[styles.thresholdDash, { borderColor: theme.primary }]} />
            <Text style={[styles.thresholdLabel, { color: theme.primary }]}>
              通知 {threshold}℃
            </Text>
          </View>

          {/* 「明日」境界の縦線。 */}
          {tomorrowIndex > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.dayDivider,
                { left: tomorrowIndex * BAR_WIDTH, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>
                明日
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 13,
  },
  summaryStrong: {
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  barsRow: {
    flexDirection: 'row',
  },
  column: {
    width: BAR_WIDTH,
    alignItems: 'center',
  },
  valueLabel: {
    height: VALUE_LABEL_H,
    fontSize: 11,
    textAlign: 'center',
  },
  markerRow: {
    height: MARKER_H,
    justifyContent: 'center',
  },
  hourLabel: {
    height: HOUR_LABEL_H,
    fontSize: 11,
    textAlign: 'center',
  },
  thresholdLine: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thresholdDash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  thresholdLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  dayDivider: {
    position: 'absolute',
    top: VALUE_LABEL_H,
    height: MAX_BAR_HEIGHT,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    paddingLeft: 2,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
    width: 110,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipTime: {
    fontSize: 10,
  },
});
