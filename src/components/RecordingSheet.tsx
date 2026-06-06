/**
 * 記録中ボトムシート。
 *
 * 記録中（isRecording）の間だけ表示し、経過時間・現在の WBGT・最大 WBGT を示す。
 * 活動種別（プリセット + カスタム入力）、作業者数（biz のみ）、講じた措置の
 * チェックリストを編集でき、終了ボタンで記録を確定する。
 */

import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getFlavor, useLabel } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { useRecordStore } from '../stores/recordStore';
import { useWbgtStore } from '../stores/wbgtStore';
import { classifyRiskLevel } from '../services/wbgtCalculator';
import {
  ACTIVITY_PRESETS,
  MEASURE_PRESETS,
  RISK_LEVEL_COLORS,
} from '../utils/constants';

/** 開始時刻（ISO）から現在までの経過を「H:MM:SS」表記にする。 */
function formatElapsed(startIso: string, now: number): string {
  const elapsedSec = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const s = elapsedSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${h}:${mm}:${ss}`;
}

export default function RecordingSheet() {
  const labels = useLabel();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const flavor = getFlavor();

  const isRecording = useRecordStore((s) => s.isRecording);
  const currentRecord = useRecordStore((s) => s.currentRecord);
  const updateCurrentRecord = useRecordStore((s) => s.updateCurrentRecord);
  const stopRecording = useRecordStore((s) => s.stopRecording);

  const currentWbgt = useWbgtStore((s) => s.current);

  // 経過時間表示のための 1 秒ごとの再描画用タイマー。
  const [now, setNow] = useState(() => Date.now());
  // カスタム活動種別の入力テキスト。
  const [customActivity, setCustomActivity] = useState('');

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  if (!isRecording || !currentRecord) {
    return null;
  }

  const presets = ACTIVITY_PRESETS[flavor];
  const measures = MEASURE_PRESETS[flavor];
  const isPresetSelected = presets.includes(currentRecord.activityType);

  const toggleMeasure = (measure: string) => {
    const selected = currentRecord.measures.includes(measure);
    const next = selected
      ? currentRecord.measures.filter((m) => m !== measure)
      : [...currentRecord.measures, measure];
    void updateCurrentRecord({ measures: next });
  };

  const maxRiskColor = RISK_LEVEL_COLORS[classifyRiskLevel(currentRecord.maxWbgt)];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => void stopRecording()}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 経過時間・WBGT サマリー */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  経過時間
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {formatElapsed(currentRecord.startTime, now)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  現在 WBGT
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {currentWbgt ? `${currentWbgt.wbgt.toFixed(1)}℃` : '—'}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  最大 WBGT
                </Text>
                <Text style={[styles.statValue, { color: maxRiskColor }]}>
                  {currentRecord.maxWbgt.toFixed(1)}℃
                </Text>
              </View>
            </View>

            {/* 活動種別 */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>活動種別</Text>
            <View style={styles.chipRow}>
              {presets.map((preset) => {
                const active = currentRecord.activityType === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.primary : 'transparent',
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => void updateCurrentRecord({ activityType: preset })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.onPrimary : theme.text },
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: !isPresetSelected && currentRecord.activityType
                    ? theme.primary
                    : theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="その他（自由入力）"
              placeholderTextColor={theme.textSecondary}
              value={isPresetSelected ? customActivity : currentRecord.activityType}
              onChangeText={(text) => {
                setCustomActivity(text);
                void updateCurrentRecord({ activityType: text });
              }}
            />

            {/* 作業者数（biz のみ） */}
            {labels.workerCount != null && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {labels.workerCount}
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  placeholder="人数を入力"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={
                    currentRecord.workerCount != null
                      ? String(currentRecord.workerCount)
                      : ''
                  }
                  onChangeText={(text) => {
                    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    void updateCurrentRecord({
                      workerCount: Number.isNaN(n) ? null : n,
                    });
                  }}
                />
              </>
            )}

            {/* 講じた措置 */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {labels.measureLabel}
            </Text>
            <View style={styles.measureList}>
              {measures.map((measure) => {
                const checked = currentRecord.measures.includes(measure);
                return (
                  <TouchableOpacity
                    key={measure}
                    style={styles.measureRow}
                    onPress={() => toggleMeasure(measure)}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? theme.primary : theme.textSecondary}
                    />
                    <Text style={[styles.measureText, { color: theme.text }]}>
                      {measure}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 終了ボタン */}
            <TouchableOpacity
              style={[styles.stopButton, { backgroundColor: theme.primary }]}
              activeOpacity={0.85}
              onPress={() => void stopRecording()}
            >
              <Text style={[styles.stopButtonText, { color: theme.onPrimary }]}>
                {labels.endButton}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 10,
  },
  measureList: {
    gap: 4,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  measureText: {
    fontSize: 15,
  },
  stopButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
