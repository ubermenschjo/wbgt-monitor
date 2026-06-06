/**
 * 設定画面。
 *
 * 通知の ON/OFF、WBGT 通知しきい値（25〜33℃、既定 28℃）の調整、
 * アプリのバージョン表示を行う。フレーバーに応じてラベルを切り替える。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';

import { getFlavor, useLabel } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { useSettingsStore } from '../stores/settingsStore';
import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  type NotificationPermissionStatus,
} from '../services/notificationService';

/** しきい値スライダーの下限・上限（℃）。 */
const THRESHOLD_MIN = 25;
const THRESHOLD_MAX = 33;

/** 権限状態に対応する表示文言。 */
const PERMISSION_LABELS: Record<NotificationPermissionStatus, string> = {
  granted: '許可済み',
  denied: '拒否されています',
  undetermined: '未設定',
};

export default function SettingsScreen() {
  const labels = useLabel();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flavor = getFlavor();

  const notificationsEnabled = useSettingsStore((s) => s.notificationEnabled);
  const wbgtThreshold = useSettingsStore((s) => s.wbgtThreshold);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // スライダー操作中の表示用の値（離した時にストアへ永続化する）。
  const [threshold, setThreshold] = useState(wbgtThreshold);
  // ストア側の値が変わったら表示用の値も同期する。
  useEffect(() => {
    setThreshold(wbgtThreshold);
  }, [wbgtThreshold]);

  const [permission, setPermission] =
    useState<NotificationPermissionStatus>('undetermined');

  // 画面表示のたびに権限状態を再取得する（設定アプリから戻った場合に反映）。
  useFocusEffect(
    useCallback(() => {
      void getNotificationPermissionStatus().then(setPermission);
    }, []),
  );

  // 通知 ON/OFF の切り替え。ON 時は未許可なら権限を要求する。
  const handleToggleNotifications = useCallback(
    (value: boolean) => {
      void updateSettings({ notificationEnabled: value });
      if (value) {
        void requestNotificationPermissions().then(setPermission);
      }
    },
    [updateSettings],
  );

  const appVersion = Constants.expoConfig?.version ?? '不明';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        通知
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            熱中症アラート通知
          </Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: theme.border, true: theme.primary }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            通知の許可状態
          </Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
            {PERMISSION_LABELS[permission]}
          </Text>
        </View>

        {permission === 'denied' && (
          <TouchableOpacity
            style={[styles.settingsButton, { borderColor: theme.primary }]}
            onPress={() => void Linking.openSettings()}
          >
            <Text style={[styles.settingsButtonText, { color: theme.primary }]}>
              通知を有効にするには設定を開く
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.thresholdHeader}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>
            通知しきい値（WBGT）
          </Text>
          <Text style={[styles.thresholdValue, { color: theme.primary }]}>
            {threshold.toFixed(0)}℃
          </Text>
        </View>
        <Slider
          minimumValue={THRESHOLD_MIN}
          maximumValue={THRESHOLD_MAX}
          step={1}
          value={threshold}
          onValueChange={setThreshold}
          onSlidingComplete={(value) =>
            void updateSettings({ wbgtThreshold: value })
          }
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
          disabled={!notificationsEnabled}
        />
        <View style={styles.sliderScale}>
          <Text style={[styles.scaleText, { color: theme.textSecondary }]}>
            {THRESHOLD_MIN}℃
          </Text>
          <Text style={[styles.scaleText, { color: theme.textSecondary }]}>
            {THRESHOLD_MAX}℃
          </Text>
        </View>
      </View>

      {labels.csvExport && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            データ
          </Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>
                {labels.recordSection}のCSV書き出し
              </Text>
              <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
                利用可能
              </Text>
            </View>
          </View>
        </>
      )}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        アプリ情報
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>名称</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
            {labels.appName}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>エディション</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
            {flavor === 'biz' ? '業務向け' : '一般向け'}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>バージョン</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
            {appVersion}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowValue: {
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  settingsButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  thresholdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  thresholdValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  scaleText: {
    fontSize: 12,
  },
});
