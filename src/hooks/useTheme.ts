/**
 * フレーバー（biz / consumer）とカラースキーム（ライト / ダーク）に応じた
 * 配色テーマを返すフック。
 *
 * 既定はライトモード。端末がダークモードの場合は背景・文字色を切り替える。
 */

import { useColorScheme } from 'react-native';

import { getFlavor, type Flavor } from './useLabel';

/** 画面全体で使用する配色テーマ。 */
export interface Theme {
  /** フレーバー固有のプライマリ色。 */
  primary: string;
  /** プライマリ色の上に乗せる文字色。 */
  onPrimary: string;
  /** 画面背景色。 */
  background: string;
  /** カード・面の色。 */
  surface: string;
  /** 主要な文字色。 */
  text: string;
  /** 補助的な文字色。 */
  textSecondary: string;
  /** 区切り線・枠線の色。 */
  border: string;
  /** ダークモードかどうか。 */
  isDark: boolean;
}

/** フレーバーごとのプライマリ色。 */
const PRIMARY: Record<Flavor, string> = {
  biz: '#1a237e', // ネイビー（業務向け・堅実な印象）
  consumer: '#FF6B35', // ウォームオレンジ（一般向け・親しみやすい印象）
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const primary = PRIMARY[getFlavor()];

  return {
    primary,
    onPrimary: '#ffffff',
    background: isDark ? '#121212' : '#f2f3f5',
    surface: isDark ? '#1e1e1e' : '#ffffff',
    text: isDark ? '#f5f5f5' : '#1a1a1a',
    textSecondary: isDark ? '#9e9e9e' : '#666666',
    border: isDark ? '#2c2c2c' : '#e6e8eb',
    isDark,
  };
}
