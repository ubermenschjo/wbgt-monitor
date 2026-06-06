/**
 * オンボーディング画面。
 *
 * 初回起動時にアプリの説明と各種権限の許可を案内する複数ステップのフロー。
 * 横スワイプでページを切り替え、各ページに「スキップ」、最下部にドット
 * インジケーターと進行ボタンを表示する。文面はフレーバーで切り替える。
 *
 * 完了（最後まで進む or スキップ）時に onComplete を呼び出す。
 * 完了フラグの永続化は呼び出し側（App）で行う。
 */

import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getFlavor } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { requestLocationPermission } from '../services/locationService';
import { requestNotificationPermissions } from '../services/notificationService';

/** 1 ページ分の定義。 */
interface OnboardingPage {
  /** アイキャッチに使うアイコン名。 */
  icon: keyof typeof Ionicons.glyphMap;
  /** 見出し。 */
  title: string;
  /** 本文。 */
  description: string;
  /** 権限要求などのアクション（任意）。 */
  action?: {
    label: string;
    run: () => Promise<unknown>;
  };
}

interface OnboardingScreenProps {
  /** 全ステップ完了 or スキップ時に呼ばれる。 */
  onComplete: () => void;
}

/** フレーバーに応じたページ定義の配列を組み立てる。 */
function buildPages(): OnboardingPage[] {
  const isBiz = getFlavor() === 'biz';

  return [
    {
      icon: 'sunny',
      title: 'ようこそ',
      description: isBiz
        ? '熱中症対策の記録を、1タップで。'
        : '暑い日も安心。熱中症から身を守ろう。',
    },
    {
      icon: 'location',
      title: '位置情報の許可',
      description:
        '現在地の暑さ指数（WBGT）を算出するために位置情報を利用します。',
      action: {
        label: '位置情報を許可',
        run: requestLocationPermission,
      },
    },
    {
      icon: 'notifications',
      title: '通知の許可',
      description:
        '暑さ指数が危険なレベルに達したとき、通知でお知らせします。',
      action: {
        label: '通知を許可',
        run: requestNotificationPermissions,
      },
    },
    {
      icon: 'checkmark-circle',
      title: '準備完了',
      description: isBiz
        ? 'さあ、最初の現場を記録しましょう'
        : '準備完了！今日の暑さ指数をチェック',
    },
  ];
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useRef(buildPages()).current;
  const isLastPage = pageIndex === pages.length - 1;

  /** 指定インデックスのページへスクロールする。 */
  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPageIndex(index);
  };

  /** 次のページへ進む。最後のページなら完了する。 */
  const handleNext = () => {
    if (isLastPage) {
      onComplete();
      return;
    }
    goToPage(pageIndex + 1);
  };

  /** スクロール終了時に現在のページインデックスを更新する。 */
  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setPageIndex(index);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onComplete} hitSlop={12}>
          <Text style={[styles.skip, { color: theme.textSecondary }]}>
            スキップ
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {pages.map((page) => (
          <View key={page.title} style={[styles.page, { width }]}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name={page.icon} size={88} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {page.title}
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {page.description}
            </Text>

            {page.action && (
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: theme.primary }]}
                activeOpacity={0.85}
                onPress={() => void page.action?.run()}
              >
                <Text style={[styles.actionText, { color: theme.primary }]}>
                  {page.action.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {pages.map((page, index) => (
            <View
              key={page.title}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === pageIndex ? theme.primary : theme.border,
                  width: index === pageIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: theme.primary }]}
          activeOpacity={0.85}
          onPress={handleNext}
        >
          <Text style={[styles.nextText, { color: theme.onPrimary }]}>
            {isLastPage ? '始める' : '次へ'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 32,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
