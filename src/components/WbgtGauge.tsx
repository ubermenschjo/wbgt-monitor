/**
 * WBGT 半円ゲージ。
 *
 * 0〜40℃ のレンジを 5 段階のリスクレベルで色分けした円弧で表示し、
 * 現在値を指すアニメーション付きの針と、中央の数値・リスクラベルを描画する。
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_LABELS,
  type RiskLevel,
} from '../utils/constants';

/** ゲージの最大値（℃）。 */
const GAUGE_MAX = 40;
/** ゲージ全体の幅（px）。 */
const SIZE = 280;
/** 円弧の太さ（px）。 */
const STROKE = 24;

const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = RADIUS + STROKE / 2;

const NEEDLE_LENGTH = RADIUS - STROKE / 2 - 8;
const NEEDLE_WIDTH = 6;

interface Segment {
  from: number;
  to: number;
  level: RiskLevel;
}

/** WBGT 区間（0〜40℃）を 5 段階のリスクレベルに対応付ける。 */
const SEGMENTS: Segment[] = [
  { from: 0, to: 21, level: 1 },
  { from: 21, to: 25, level: 2 },
  { from: 25, to: 28, level: 3 },
  { from: 28, to: 31, level: 4 },
  { from: 31, to: GAUGE_MAX, level: 5 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** WBGT 値を角度（左=180°, 上=90°, 右=0°）へ変換する。 */
function valueToAngle(value: number): number {
  const fraction = clamp(value, 0, GAUGE_MAX) / GAUGE_MAX;
  return 180 * (1 - fraction);
}

/** 角度（度）と半径から SVG 座標（y は下向き）を求める。 */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

/** 2 つの WBGT 値の間を結ぶ円弧の SVG パスを生成する。 */
function arcPath(fromValue: number, toValue: number): string {
  const start = polar(valueToAngle(fromValue), RADIUS);
  const end = polar(valueToAngle(toValue), RADIUS);
  // 各区間は 180° 未満なので large-arc-flag=0、上側を通る時計回り sweep=1。
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`;
}

interface WbgtGaugeProps {
  /** 表示する WBGT 値（℃）。 */
  value: number;
  /** リスクレベル（1〜5）。 */
  riskLevel: RiskLevel;
}

export default function WbgtGauge({ value, riskLevel }: WbgtGaugeProps) {
  const theme = useTheme();
  const needleAnim = useRef(new Animated.Value(clamp(value, 0, GAUGE_MAX))).current;

  useEffect(() => {
    Animated.timing(needleAnim, {
      toValue: clamp(value, 0, GAUGE_MAX),
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [value, needleAnim]);

  // 値 0 で左（-90°）、値 40 で右（+90°）を指すよう針を回転させる。
  const rotate = needleAnim.interpolate({
    inputRange: [0, GAUGE_MAX],
    outputRange: ['-90deg', '90deg'],
  });

  return (
    <View style={[styles.container, { width: SIZE, height: CY + 116 }]}>
      <Svg width={SIZE} height={CY + STROKE / 2}>
        {SEGMENTS.map((seg) => (
          <Path
            key={seg.level}
            d={arcPath(seg.from, seg.to)}
            stroke={RISK_LEVEL_COLORS[seg.level]}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            fill="none"
          />
        ))}
      </Svg>

      <Animated.View
        style={[
          styles.needle,
          {
            left: CX - NEEDLE_WIDTH / 2,
            top: CY - NEEDLE_LENGTH,
            transform: [
              { translateY: NEEDLE_LENGTH / 2 },
              { rotate },
              { translateY: -NEEDLE_LENGTH / 2 },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.hub,
          { left: CX - 10, top: CY - 10, backgroundColor: theme.text },
        ]}
      />

      <View style={[styles.readout, { top: CY + 6 }]}>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: theme.text }]}>
            {value.toFixed(1)}
          </Text>
          <Text style={[styles.unit, { color: theme.textSecondary }]}>℃</Text>
        </View>
        <View
          style={[styles.badge, { backgroundColor: RISK_LEVEL_COLORS[riskLevel] }]}
        >
          <Text style={styles.badgeText}>{RISK_LEVEL_LABELS[riskLevel]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  needle: {
    position: 'absolute',
    width: NEEDLE_WIDTH,
    height: NEEDLE_LENGTH,
    borderRadius: NEEDLE_WIDTH / 2,
    backgroundColor: '#37474f',
  },
  hub: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  readout: {
    position: 'absolute',
    width: SIZE,
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 56,
  },
  unit: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 2,
  },
  badge: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
