/**
 * Paywall 画面（biz flavor 限定）。
 *
 * B2B プラン比較 + 7日間無料トライアル開始 + 購入フロー。
 * consumer flavor からは遷移されない。
 *
 * ## 価格ポリシー
 * - ライト: ¥3,000/月 — 10人
 * - スタンダード: ¥10,000/月 — 50人
 * - エンタープライズ: ¥30,000/月 — 無制限
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { useTheme } from '../hooks/useTheme';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  PLANS,
  type PlanId,
} from '../services/subscriptionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PaywallScreen({ navigation }: { navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const checkSubscription = useSubscriptionStore((s) => s.checkSubscription);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('lite');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // オファリング取得
  useEffect(() => {
    void (async () => {
      const offering = await getOfferings();
      if (offering) {
        setPackages(offering.availablePackages);
      }
      setLoading(false);
    })();
  }, []);

  // 購入
  const handlePurchase = useCallback(async () => {
    const pkg = packages.find((p) => p.identifier.includes(selectedPlan));
    if (!pkg) {
      Alert.alert('エラー', 'プランが見つかりません。しばらく待ってからお試しください。');
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchasePackage(pkg.identifier);
      if (result) {
        await checkSubscription();
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('購入エラー', e.message ?? '購入処理に失敗しました。');
    } finally {
      setPurchasing(false);
    }
  }, [packages, selectedPlan, checkSubscription, navigation]);

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
      <View style={styles.trialBadge}>
        <Text style={styles.trialText}>7日間無料でお試し</Text>
      </View>

      {/* プラン比較 */}
      <View style={styles.plansContainer}>
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: isSelected ? '#15b788' : theme.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>おすすめ</Text>
                </View>
              )}
              <Text style={[styles.planName, { color: theme.text }]}>
                {plan.name}
              </Text>
              <Text style={[styles.planPrice, { color: '#15b788' }]}>
                {plan.monthlyPrice}
                <Text style={styles.planPriceUnit}>/月</Text>
              </Text>
              <Text style={[styles.planAnnual, { color: theme.textSecondary }]}>
                年払い {plan.annualPrice}
              </Text>
              <Text style={[styles.planWorkers, { color: theme.textSecondary }]}>
                {plan.maxWorkers === Infinity
                  ? '無制限'
                  : `${plan.maxWorkers}人まで`}
              </Text>
              <View style={styles.featuresContainer}>
                {plan.features.map((f) => (
                  <Text
                    key={f}
                    style={[styles.featureItem, { color: theme.text }]}
                  >
                    ✓ {f}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
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
            無料トライアルを開始
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.trialNote, { color: theme.textSecondary }]}>
        7日間の無料期間後に課金が開始されます。{'\n'}
        いつでもキャンセル可能です。
      </Text>

      {/* 復元リンク */}
      <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
        <Text style={[styles.restoreText, { color: theme.textSecondary }]}>
          以前の購入を復元
        </Text>
      </TouchableOpacity>

      {/* 法的リンク */}
      <View style={styles.legalContainer}>
        <Text style={[styles.legalText, { color: theme.textSecondary }]}>
          利用規約 | プライバシーポリシー
        </Text>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  trialBadge: {
    backgroundColor: '#15b788',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  trialText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  plansContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    borderRadius: 14,
    padding: 16,
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: '#15b788',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
  },
  planPriceUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  planAnnual: {
    fontSize: 13,
    marginBottom: 4,
  },
  planWorkers: {
    fontSize: 13,
    marginBottom: 8,
  },
  featuresContainer: {
    gap: 3,
  },
  featureItem: {
    fontSize: 13,
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
  trialNote: {
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
  },
  legalText: {
    fontSize: 12,
  },
});
