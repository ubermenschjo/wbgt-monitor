/**
 * AlertActionModal — WBGT 경고 발생 시 표시되는 조치 선택 모달。
 * 조치를 선택한 뒤 "계속" 또는 "中断" 을 결정한다。
 */

import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getFlavor } from '../hooks/useLabel';
import { MEASURE_PRESETS, RISK_LEVEL_COLORS } from '../utils/constants';
import { getRiskLevel } from '../utils/wbgtUtils';

interface Props {
  visible: boolean;
  wbgt: number | null;
  onSubmit: (measures: string[], action: 'continue' | 'pause') => void;
}

export default function AlertActionModal({ visible, wbgt, onSubmit }: Props) {
  const flavor = getFlavor();
  const presets = MEASURE_PRESETS[flavor];
  const [selected, setSelected] = useState<string[]>([]);

  const riskLevel = wbgt != null ? getRiskLevel(wbgt) : 3;
  const riskColor = RISK_LEVEL_COLORS[riskLevel];

  const toggle = (item: string) => {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item],
    );
  };

  const handleSubmit = (action: 'continue' | 'pause') => {
    onSubmit(selected.length > 0 ? selected : ['確認のみ'], action);
    setSelected([]);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* ヘッダー（警告） */}
          <View style={[styles.alertHeader, { backgroundColor: riskColor }]}>
            <Ionicons name="warning" size={24} color="#fff" />
            <Text style={styles.alertTitle}>WBGT 警告</Text>
          </View>

          {wbgt != null && (
            <Text style={styles.wbgtValue}>
              現在 WBGT: <Text style={{ color: riskColor, fontWeight: '800' }}>{wbgt.toFixed(1)}℃</Text>
            </Text>
          )}

          <Text style={styles.sectionTitle}>実施する措置を選択</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {presets.map((preset) => {
              const isSelected = selected.includes(preset);
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => toggle(preset)}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isSelected ? '#1a237e' : '#999'}
                  />
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* アクションボタン */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.pauseBtn]}
              onPress={() => handleSubmit('pause')}
            >
              <Ionicons name="pause" size={16} color="#fff" />
              <Text style={styles.btnText}>中断する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.continueBtn]}
              onPress={() => handleSubmit('continue')}
            >
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.btnText}>続行する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  wbgtValue: {
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 12,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: '#e8eaf6',
  },
  optionText: {
    fontSize: 15,
    color: '#333',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#1a237e',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pauseBtn: {
    backgroundColor: '#FF9800',
  },
  continueBtn: {
    backgroundColor: '#4CAF50',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
