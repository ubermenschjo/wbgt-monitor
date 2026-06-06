/**
 * StartRecordingModal — 作業開始時のモーダル。
 * 作業種別と作業者数を選択して記録を開始する。
 */

import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getFlavor } from '../hooks/useLabel';
import { ACTIVITY_PRESETS } from '../utils/constants';

interface Props {
  visible: boolean;
  onStart: (activityType: string, workerCount: number | null) => void;
  onCancel: () => void;
}

export default function StartRecordingModal({ visible, onStart, onCancel }: Props) {
  const flavor = getFlavor();
  const presets = ACTIVITY_PRESETS[flavor];
  const isBiz = flavor === 'biz';

  const [selectedActivity, setSelectedActivity] = useState<string>(presets[0]);
  const [customActivity, setCustomActivity] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [workerCount, setWorkerCount] = useState('1');

  const handleStart = () => {
    const activity = isCustom ? customActivity.trim() || presets[0] : selectedActivity;
    const count = isBiz ? parseInt(workerCount, 10) || 1 : null;
    onStart(activity, count);
    // リセット
    setSelectedActivity(presets[0]);
    setCustomActivity('');
    setIsCustom(false);
    setWorkerCount('1');
  };

  const handleCancel = () => {
    setSelectedActivity(presets[0]);
    setCustomActivity('');
    setIsCustom(false);
    setWorkerCount('1');
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>作業開始</Text>
            <TouchableOpacity onPress={handleCancel} hitSlop={8}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 作業種別 */}
          <Text style={styles.sectionTitle}>作業種別</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {presets.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.chip,
                  !isCustom && selectedActivity === preset && styles.chipSelected,
                ]}
                onPress={() => {
                  setSelectedActivity(preset);
                  setIsCustom(false);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    !isCustom && selectedActivity === preset && styles.chipTextSelected,
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, isCustom && styles.chipSelected]}
              onPress={() => setIsCustom(true)}
            >
              <Text style={[styles.chipText, isCustom && styles.chipTextSelected]}>
                その他
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {isCustom && (
            <TextInput
              style={styles.input}
              placeholder="作業種別を入力"
              value={customActivity}
              onChangeText={setCustomActivity}
              autoFocus
            />
          )}

          {/* 作業者数（biz のみ） */}
          {isBiz && (
            <>
              <Text style={styles.sectionTitle}>作業者数</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => {
                    const n = Math.max(1, parseInt(workerCount, 10) - 1);
                    setWorkerCount(String(n));
                  }}
                >
                  <Ionicons name="remove" size={20} color="#333" />
                </TouchableOpacity>
                <TextInput
                  style={styles.counterInput}
                  keyboardType="number-pad"
                  value={workerCount}
                  onChangeText={setWorkerCount}
                />
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => {
                    const n = parseInt(workerCount, 10) + 1;
                    setWorkerCount(String(n));
                  }}
                >
                  <Ionicons name="add" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.unitText}>人</Text>
              </View>
            </>
          )}

          {/* 開始ボタン */}
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.startBtnText}>記録開始</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
    marginBottom: 8,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#1a237e',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginTop: 8,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  unitText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 4,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a237e',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    gap: 8,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
