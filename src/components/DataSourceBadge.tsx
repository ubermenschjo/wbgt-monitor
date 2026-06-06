/**
 * データソース表示バッジ。
 *
 * 現在表示している WBGT 値の出所を小さなバッジで示す。
 * ソース種別ごとに色とラベルを変え、ユーザーが値の信頼度を判断できるようにする。
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

/** データソース種別。 */
export type DataSource = 'estimated' | 'ministry' | 'sensor';

interface SourceStyle {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** 種別ごとのラベル・色・アイコン定義。 */
const SOURCE_STYLES: Record<DataSource, SourceStyle> = {
  // 推定値: 自前の推定式（グレー＝参考値）。
  estimated: { label: '推定値', color: '#78909C', icon: 'calculator-outline' },
  // 環境省データ: 公的データ（グリーン＝信頼度高）。
  ministry: { label: '環境省データ', color: '#2E7D32', icon: 'shield-checkmark-outline' },
  // 実測値: 将来のセンサー連携（ブルー＝直接計測）。
  sensor: { label: '実測値', color: '#1565C0', icon: 'hardware-chip-outline' },
};

interface DataSourceBadgeProps {
  /** 表示するデータソース種別。 */
  source: DataSource;
  /** ラベルへ付与する補足テキスト（地点名など）。 */
  detail?: string;
}

export default function DataSourceBadge({ source, detail }: DataSourceBadgeProps) {
  const { label, color, icon } = SOURCE_STYLES[source];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.label, { color }]}>
        {detail ? `${label}・${detail}` : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
