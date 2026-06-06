/**
 * RecordingSheet — 記録中の詳細情報を表示するボトムシート。
 * FloatingBar をタップすると展開し、下にスワイプまたは閉じるボタンで非表示にする。
 *
 * 表示内容:
 * - 活動種別・作業者数
 * - 経過時間(実作業/総合)
 * - 最大 WBGT
 * - 措置履歴
 * - メモ入力
 */

import { useEffect, useState } from 'react';
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

import { useRecordStore } from '../stores/recordStore';
import { useWbgtStore } from '../stores/wbgtStore';
import { getRiskLevel } from '../utils/wbgtUtils';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from '../utils/constants';

/** 秒数を "HH:MM:SS" に変換。 */
function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RecordingSheet() {
  const {
    isRecording,
    isPaused,
    pausedAt,
    pausedDuration,
    currentRecord,
    sheetVisible,
    hideSheet,
    updateCurrentRecord,
  } = useRecordStore();

  const current = useWbgtStore((s) => s.current);

  const [elapsed, setElapsed] = useState(0);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (currentRecord) {
      setMemo(currentRecord.memo);
    }
  }, [currentRecord?.id]);

  // 経過時間の計算
  useEffect(() => {
    if (!isRecording || !currentRecord) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      const start = new Date(currentRecord.startTime).getTime();
      const now = Date.now();
      let total = Math.floor((now - start) / 1000);
      let paused = pausedDuration;
      if (isPaused && pausedAt) {
        paused += Math.floor((now - new Date(pausedAt).getTime()) / 1000);
      }
      total = Math.max(0, total - paused);
      setElapsed(total);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRecording, isPaused, pausedAt, pausedDuration, currentRecord]);

  if (!isRecording || !currentRecord) return null;

  const riskLevel = current ? getRiskLevel(current.wbgt) : 1;
  const riskColor = RISK_LEVEL_COLORS[riskLevel];
  const riskLabel = RISK_LEVEL_LABELS[riskLevel];

  const handleMemoBlur = () => {
    if (memo !== currentRecord.memo) {
      void updateCurrentRecord({ memo });
    }
  };

  return (
    <Modal visible={sheetVisible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} onPress={hideSheet} />
        <View style={styles.sheet}>
          {/* ハンドル */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* ヘッダー */}
          <View style={styles.header}>
            <Text style={styles.title}>記録中</Text>
            <TouchableOpacity onPress={hideSheet} hitSlop={8}>
              <Ionicons name="chevron-down" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 作業情報 */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>作業種別</Text>
                <Text style={styles.infoValue}>{currentRecord.activityType}</Text>
              </View>
              {currentRecord.workerCount != null && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>作業者数</Text>
                  <Text style={styles.infoValue}>{currentRecord.workerCount}人</Text>
                </View>
              )}
            </View>

            {/* 経過時間 */}
            <View style={styles.timerCard}>
              <View style={styles.timerRow}>
                <Ionicons
                  name={isPaused ? 'pause-circle' : 'timer'}
                  size={20}
                  color={isPaused ? '#FF9800' : '#1a237e'}
                />
                <Text style={styles.timerValue}>{formatElapsed(elapsed)}</Text>
                {isPaused && <Text style={styles.pausedBadge}>中断中</Text>}
              </View>
              {pausedDuration > 0 && (
                <Text style={styles.pausedInfo}>
                  累積中断: {formatElapsed(pausedDuration)}
                </Text>
              )}
            </View>

            {/* WBGT */}
            <View style={styles.wbgtCard}>
              <Text style={styles.infoLabel}>現在 WBGT</Text>
              <View style={styles.wbgtRow}>
                <Text style={[styles.wbgtValue, { color: riskColor }]}>
                  {current ? `${current.wbgt.toFixed(1)}℃` : '---'}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: riskColor }]}>
                  <Text style={styles.riskBadgeText}>{riskLabel}</Text>
                </View>
              </View>
              <Text style={styles.maxWbgt}>
                最大 WBGT: {currentRecord.maxWbgt.toFixed(1)}℃
              </Text>
            </View>

            {/* 措置 */}
            {currentRecord.measures.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.infoLabel}>実施措置</Text>
                <View style={styles.measuresWrap}>
                  {currentRecord.measures.map((m) => (
                    <View key={m} style={styles.measureChip}>
                      <Text style={styles.measureText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* メモ */}
            <View style={styles.section}>
              <Text style={styles.infoLabel}>メモ</Text>
              <TextInput
                style={styles.memoInput}
                multiline
                placeholder="メモを入力..."
                value={memo}
                onChangeText={setMemo}
                onBlur={handleMemoBlur}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  infoItem: {},
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    fontVariant: ['tabular-nums'],
  },
  pausedBadge: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 8,
  },
  pausedInfo: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  wbgtCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  wbgtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wbgtValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  maxWbgt: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  section: {
    marginBottom: 16,
  },
  measuresWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  measureChip: {
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  measureText: {
    fontSize: 13,
    color: '#1a237e',
  },
  memoInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
