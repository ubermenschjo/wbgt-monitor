/**
 * Paywall 画面（biz flavor 限定）。
 *
 * v1.0: ライトプランのみ。シンプルな購入画面。
 * Standard/Enterprise は Phase 2/3 で解禁。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import {
  findOfferingPackage,
  getOfferings,
  purchasePlan,
  restorePurchases,
  AVAILABLE_PLANS,
} from '../services/subscriptionService';
import { getLegalUrls } from '../utils/legalUrls';
import { SUBSCRIPTION_RENEWAL_NOTE } from '../utils/subscriptionDisclosure';
import type { PurchasesPackage } from 'react-native-purchases';

const LITE_PLAN = AVAILABLE_PLANS[0]; // v1.0 はライトのみ（月額のみ販売）
const SUBSCRIPTION_PERIOD_LABEL = '1ヶ月';
const { privacyPolicyUrl, termsOfUseUrl } = getLegalUrls();

async function openLegalUrl(url: string, label: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('unsupported');
    await Linking.openURL(url);
  } catch {
    Alert.alert('リンクを開けません', `${label}をブラウザで直接開いてください。`);
  }
}

export default function PaywallScreen({ navigation }: { navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const checkSubscription = useSubscriptionStore((s) => s.checkSubscription);

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [litePackage, setLitePackage] = useState<PurchasesPackage | null>(null);

  const subscriptionTitle =
    litePackage?.product.title ?? `${LITE_PLAN.name}プラン`;
  const subscriptionPrice =
    litePackage?.product.priceString ?? LITE_PLAN.monthlyPrice;
  const subscriptionPeriod = SUBSCRIPTION_PERIOD_LABEL;

  // オファリング取得
  useEffect(() => {
    void (async () => {
      try {
        const offering = await getOfferings();
        const pkg = findOfferingPackage(offering, 'lite');
        if (pkg) {
          setLitePackage(pkg);
        }
      } catch {
        // RevenueCat未設定時
      }
      setLoading(false);
    })();
  }, []);

  // 購入
  const handlePurchase = useCallback(async () => {
    if (!litePackage) {
      Alert.alert(
        '準備中',
        'サブスクリプション商品の準備ができていません。しばらくお待ちください。',
      );
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchasePlan('lite');
      if (result) {
        await checkSubscription();
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('購入エラー', e.message ?? '購入処理に失敗しました。');
    } finally {
      setPurchasing(false);
    }
  }, [litePackage, checkSubscription, navigation]);

  // 復元
  const handleRestore = useCallback(async () => {
    setLoading(true);
    try {
      await restorePurchases();
      await checkSubscription();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('復元エラー', e.message ?? '購入の復元に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [checkSubscription, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      {/* ヘッダー */}
      <Text style={[styles.title, { color: theme.text }]}>
        熱中症レコーダー Pro
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        現場の安全管理を、もっとシンプルに。
      </Text>

      {/* ライトプラン紹介 */}
      <View
        style={[
          styles.planCard,
          { backgroundColor: theme.surface, borderColor: '#15b788' },
        ]}
      >
        <Text style={[styles.planName, { color: theme.text }]}>
          {subscriptionTitle}
        </Text>
        <Text style={[styles.planPrice, { color: '#15b788' }]}>
          {subscriptionPrice}
          <Text style={styles.planPriceUnit}>/{subscriptionPeriod}</Text>
        </Text>
        <View style={styles.featuresContainer}>
          {LITE_PLAN.features.map((f) => (
            <Text key={f} style={[styles.featureItem, { color: theme.text }]}>
              ✓ {f}
            </Text>
          ))}
        </View>
      </View>

      {/* 購入ボタン */}
      <TouchableOpacity
        style={[styles.purchaseButton, purchasing && styles.purchaseDisabled]}
        onPress={handlePurchase}
        disabled={purchasing}
        activeOpacity={0.8}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.purchaseButtonText}>
            ライトプランで始める
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.subscriptionInfo}>
        <Text style={[styles.subscriptionInfoText, { color: theme.textSecondary }]}>
          {subscriptionTitle} · {subscriptionPeriod}（自動更新） · {subscriptionPrice}/
          {subscriptionPeriod}
        </Text>
      </View>

      <Text style={[styles.note, { color: theme.textSecondary }]}>
        {SUBSCRIPTION_RENEWAL_NOTE}
      </Text>

      {/* 復元リンク */}
      <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
        <Text style={[styles.restoreText, { color: theme.textSecondary }]}>
          以前の購入を復元
        </Text>
      </TouchableOpacity>

      {/* 法的リンク */}
      <View style={styles.legalContainer}>
        <TouchableOpacity
          onPress={() => void openLegalUrl(termsOfUseUrl, '利用規約')}
          accessibilityRole="link"
        >
          <Text style={[styles.legalLink, { color: theme.primary }]}>利用規約</Text>
        </TouchableOpacity>
        <Text style={[styles.legalSeparator, { color: theme.textSecondary }]}> | </Text>
        <TouchableOpacity
          onPress={() => void openLegalUrl(privacyPolicyUrl, 'プライバシーポリシー')}
          accessibilityRole="link"
        >
          <Text style={[styles.legalLink, { color: theme.primary }]}>
            プライバシーポリシー
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  planCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 2,
    padding: 20,
    marginBottom: 24,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
  },
  planPriceUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  featuresContainer: {
    gap: 4,
  },
  featureItem: {
    fontSize: 14,
  },
  purchaseButton: {
    backgroundColor: '#15b788',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  subscriptionInfo: {
    width: '100%',
    marginBottom: 12,
  },
  subscriptionInfoText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  restoreButton: {
    paddingVertical: 10,
    marginBottom: 16,
  },
  restoreText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legalContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 12,
  },
});
