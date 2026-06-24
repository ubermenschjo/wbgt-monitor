/**
 * STAGEN 実存アプリへのクロスプロモーションバナー。
 */

import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { StagenAppId } from '../constants/stagenApps';
import { getStagenAppStoreUrl } from '../constants/stagenApps';
import { useTheme } from '../hooks/useTheme';
import { recordBannerTap } from '../services/promoBannerService';

export type StagenAppBannerVariant = 'settings' | 'soft';

type Props = {
  targetApp: StagenAppId;
  title: string;
  subtitle: string;
  variant?: StagenAppBannerVariant;
};

async function openStoreUrl(targetApp: StagenAppId, label: string): Promise<void> {
  const url = getStagenAppStoreUrl(targetApp);
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('unsupported');
    await Linking.openURL(url);
    await recordBannerTap(targetApp);
  } catch {
    Alert.alert('リンクを開けません', `${label}のストアページをブラウザで直接開いてください。`);
  }
}

export default function StagenAppBanner({
  targetApp,
  title,
  subtitle,
  variant = 'settings',
}: Props) {
  const theme = useTheme();
  const isSoft = variant === 'soft';

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderLeftColor: theme.primary,
          marginTop: isSoft ? 0 : 8,
        },
      ]}
      onPress={() => void openStoreUrl(targetApp, title)}
      accessibilityRole="link"
      accessibilityLabel={title}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderLeftWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  body: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
