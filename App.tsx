import { useEffect } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import HomeScreen from './src/screens/HomeScreen';
import RecordScreen from './src/screens/RecordScreen';
import RecordDetailScreen from './src/screens/RecordDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { getFlavor, useLabel } from './src/hooks/useLabel';
import { initializeApp } from './src/services/appInitializer';
import type { RecordStackParamList } from './src/navigation/types';

/** タブナビゲーターのルート（通知タップ時の遷移に使用）。 */
type RootTabParamList = {
  Home: undefined;
  Record: undefined;
  Settings: undefined;
};

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
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

export default function App() {
  const labels = useLabel();

  useEffect(() => {
    void initializeApp();

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

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
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
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: '設定' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
