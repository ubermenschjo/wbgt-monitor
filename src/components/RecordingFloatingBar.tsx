/**
 * RecordingFloatingBar — 記録中に画面下部に常時表示されるフローティングバー。
 * 経過時間、現在 WBGT、一時中断/再開/終了/シート展開の操作を提供する。
 */

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRecordStore } from '../stores/recordStore';
import { useWbgtStore } from '../stores/wbgtStore';

/** 秒数を "HH:MM:SS" に変換。 */
function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RecordingFloatingBar() {
  const {
    isRecording,
    isPaused,
    pausedAt,
    pausedDuration,
    currentRecord,
    toggleSheet,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useRecordStore();

  const current = useWbgtStore((s) => s.current);

  // 経過時間（実作業時間）のリアルタイム表示
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !currentRecord) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      const start = new Date(currentRecord.startTime).getTime();
      const now = Date.now();
      let totalElapsed = Math.floor((now - start) / 1000);

      // 現在中断中なら中断時間は: 累積 + 今回中断からの経過
      let totalPaused = pausedDuration;
      if (isPaused && pausedAt) {
        totalPaused += Math.floor((now - new Date(pausedAt).getTime()) / 1000);
      }
      totalElapsed = Math.max(0, totalElapsed - totalPaused);
      setElapsed(totalElapsed);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRecording, isPaused, pausedAt, pausedDuration, currentRecord]);

  if (!isRecording || !currentRecord) return null;

  return (
    <View style={styles.container}>
      {/* 左: 時間 + WBGT */}
      <TouchableOpacity style={styles.infoArea} onPress={toggleSheet}>
        <View style={styles.row}>
          <Ionicons
            name={isPaused ? 'pause-circle' : 'recording'}
            size={16}
            color={isPaused ? '#FF9800' : '#F44336'}
          />
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        </View>
        {current && (
          <Text style={styles.wbgtText}>
            WBGT {current.wbgt.toFixed(1)}℃
          </Text>
        )}
      </TouchableOpacity>

      {/* 右: 操作ボタン */}
      <View style={styles.actions}>
        {isPaused ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.resumeBtn]}
            onPress={() => void resumeRecording()}
          >
            <Ionicons name="play" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.pauseBtn]}
            onPress={() => void pauseRecording()}
          >
            <Ionicons name="pause" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.stopBtn]}
          onPress={() => void stopRecording()}
        >
          <Ionicons name="stop" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoArea: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  wbgtText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    backgroundColor: '#FF9800',
  },
  resumeBtn: {
    backgroundColor: '#4CAF50',
  },
  stopBtn: {
    backgroundColor: '#F44336',
  },
});
