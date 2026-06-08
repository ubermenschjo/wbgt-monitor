import { useEffect, useState } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import HomeScreen from './src/screens/HomeScreen';
import RecordScreen from './src/screens/RecordScreen';
import RecordDetailScreen from './src/screens/RecordDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ExportScreen from './src/screens/ExportScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import RecordingFloatingBar from './src/components/RecordingFloatingBar';
import RecordingSheet from './src/components/RecordingSheet';
import AlertActionModal from './src/components/AlertActionModal';
import { getFlavor, useLabel } from './src/hooks/useLabel';
import { initializeApp } from './src/services/appInitializer';
import {
  getOnboardingCompleted,
  setOnboardingCompleted,
} from './src/services/database';
import { useRecordStore } from './src/stores/recordStore';
import { useSubscriptionStore } from './src/stores/subscriptionStore';
import type {
  RootStackParamList,
  RootTabParamList,
  RecordStackParamList,
} from './src/navigation/types';

/** 通知タップ時にナビゲーションを操作するための ref。 */
const navigationRef = createNavigationContainerRef<RootTabParamList>();

/** 通知タップ時にホーム画面へ遷移する。 */
function handleNotificationResponse(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Home');
  }
}

const Tab = createBottomTabNavigator();
const RecordStack = createNativeStackNavigator<RecordStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

/** 記録タブ内のスタック（一覧 → 詳細）。 */
function RecordStackNavigator() {
  const labels = useLabel();
  return (
    <RecordStack.Navigator>
      <RecordStack.Screen
        name="RecordList"
        component={RecordScreen}
        options={{ title: labels.recordSection }}
      />
      <RecordStack.Screen
        name="RecordDetail"
        component={RecordDetailScreen}
        options={{ title: '記録詳細' }}
      />
    </RecordStack.Navigator>
  );
}

// フレーバーごとのタブのアクティブ色。
const ACTIVE_TINT = getFlavor() === 'consumer' ? '#FF6B35' : '#1a237e';

/** タブ名に対応する Ionicons のアイコン名（選択時 / 非選択時）。 */
const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Record: { active: 'list', inactive: 'list-outline' },
  Export: { active: 'document-text', inactive: 'document-text-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

// 書き出しタブを表示するか（biz のみ）。
const SHOW_EXPORT_TAB = getFlavor() === 'biz';

export default function App() {
  const labels = useLabel();
  const initSubscription = useSubscriptionStore((s) => s.initialize);
  const subscriptionActive = useSubscriptionStore((s) => s.isActive);

  // null=初期化中, false=オンボーディング未完了, true=完了。
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // グローバル: 警告モーダル状態
  const alertPending = useRecordStore((s) => s.alertPending);
  const alertWbgt = useRecordStore((s) => s.alertWbgt);
  const recordAlertMeasures = useRecordStore((s) => s.recordAlertMeasures);
  const isRecording = useRecordStore((s) => s.isRecording);

  useEffect(() => {
    // 初期化後にオンボーディング完了状態を判定する（DB 初期化が前提）。
    void (async () => {
      await initializeApp();
      setOnboardingDone(await getOnboardingCompleted());
      // biz flavor のサブスクリプション SDK 初期化
      await initSubscription();
    })();

    // 起動中のタップ。
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );
    // 通知タップで起動（コールドスタート）した場合の遷移。
    if (Notifications.getLastNotificationResponse()) {
      handleNotificationResponse();
    }

    return () => subscription.remove();
  }, []);

  /** オンボーディング完了時: フラグを永続化してメイン画面へ切り替える。 */
  const handleOnboardingComplete = () => {
    void setOnboardingCompleted(true);
    setOnboardingDone(true);
  };

  // 初期化中は何も描画しない（スプラッシュを継続表示）。
  if (onboardingDone === null) {
    return null;
  }

  // 未完了ならオンボーディングを表示する。
  if (!onboardingDone) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaProvider>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
        <RootStack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
      </RootStack.Navigator>

      {/* グローバルオーバーレイ: 他タブでも表示 */}
      {isRecording && <RecordingFloatingBar />}
      <RecordingSheet />
      <AlertActionModal
        visible={alertPending}
        wbgt={alertWbgt}
        onSubmit={(measures, action) => void recordAlertMeasures(measures, action)}
      />
    </NavigationContainer>
  );
}

/** メインタブナビゲーター（RootStack 内に配置）。 */
function MainTabNavigator() {
  const labels = useLabel();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: '#9e9e9e',
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons.active : icons.inactive;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'ホーム', headerTitle: labels.appName }}
      />
      <Tab.Screen
        name="Record"
        component={RecordStackNavigator}
        options={{ title: labels.recordSection, headerShown: false }}
      />
      {SHOW_EXPORT_TAB && (
        <Tab.Screen
          name="Export"
          component={ExportScreen}
          options={{ title: '書き出し' }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '設定' }}
      />
    </Tab.Navigator>
  );
}
