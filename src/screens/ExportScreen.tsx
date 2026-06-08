/**
 * 記録の書き出し画面（主に biz 向け）。
 *
 * 日付範囲を指定し、その範囲内の作業記録を CSV または PDF に書き出して
 * システムの共有シートで出力する。会社名・現場名は設定として永続化し、
 * PDF レポートのヘッダーに反映する。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useLabel } from '../hooks/useLabel';
import { useTheme } from '../hooks/useTheme';
import { useSubscriptionGate } from '../hooks/useSubscriptionGate';
import { getRecords } from '../services/database';
import {
  exportToCSV,
  exportToPDF,
  shareFile,
} from '../services/exportService';
import { useSettingsStore } from '../stores/settingsStore';

/** 書き出し形式。 */
type ExportFormat = 'csv' | 'pdf';

/** 当日の 0 時 0 分 0 秒。 */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 当日の 23 時 59 分 59 秒。 */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Date を「YYYY/MM/DD」表記にする。 */
function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export default function ExportScreen() {
  const { gated } = useSubscriptionGate();
  const labels = useLabel();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // ゲートされた場合は何もレンダリングしない（Paywall へ遷移済み）
  if (gated) return null;

  // 既定の範囲: 今月の 1 日 〜 今日。
  const today = new Date();
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [endDate, setEndDate] = useState(today);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [count, setCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const storedCompany = useSettingsStore((s) => s.companyName);
  const storedSite = useSettingsStore((s) => s.siteName);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [companyName, setCompanyName] = useState(storedCompany);
  const [siteName, setSiteName] = useState(storedSite);

  // ストアの読み込みが後から完了した場合に入力欄へ反映する。
  useEffect(() => {
    setCompanyName(storedCompany);
  }, [storedCompany]);
  useEffect(() => {
    setSiteName(storedSite);
  }, [storedSite]);

  // 範囲内の件数を取得する。
  const loadCount = useCallback(async () => {
    setCount(null);
    try {
      const records = await getRecords({
        startDate: startOfDay(startDate).toISOString(),
        endDate: endOfDay(endDate).toISOString(),
        limit: 100000,
        offset: 0,
      });
      setCount(records.length);
    } catch {
      setCount(0);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    setPicker(null);
    if (event.type === 'dismissed' || !date) return;
    if (picker === 'start') {
      setStartDate(date);
      // 開始日が終了日より後なら終了日も合わせる。
      if (date > endDate) setEndDate(date);
    } else {
      setEndDate(date);
      if (date < startDate) setStartDate(date);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // 入力中の会社名・現場名を確定保存する。
      await updateSettings({ companyName, siteName });

      const records = await getRecords({
        startDate: startOfDay(startDate).toISOString(),
        endDate: endOfDay(endDate).toISOString(),
        limit: 100000,
        offset: 0,
      });

      if (records.length === 0) {
        Alert.alert('書き出すデータがありません', '対象期間内に記録がありません。');
        return;
      }

      const range = { from: startDate, to: endDate };
      const uri =
        format === 'csv'
          ? await exportToCSV(records, range)
          : await exportToPDF(records, range, { companyName, siteName });

      await shareFile(uri);
    } catch (e) {
      Alert.alert(
        '書き出しに失敗しました',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setExporting(false);
    }
  };

  const formatOptions: { key: ExportFormat; label: string }[] = [
    { key: 'csv', label: labels.exportCSV ?? 'CSV' },
    { key: 'pdf', label: labels.exportPDF ?? 'PDF' },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      {/* 期間 */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        対象期間
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.dateRow}
          onPress={() => setPicker('start')}
        >
          <Text style={[styles.rowLabel, { color: theme.text }]}>開始日</Text>
          <Text style={[styles.dateValue, { color: theme.primary }]}>
            {formatDate(startDate)}
          </Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <TouchableOpacity style={styles.dateRow} onPress={() => setPicker('end')}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>終了日</Text>
          <Text style={[styles.dateValue, { color: theme.primary }]}>
            {formatDate(endDate)}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.previewText, { color: theme.textSecondary }]}>
        {count == null ? '件数を確認中…' : `対象期間内に ${count} 件の記録`}
      </Text>

      {/* 形式 */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        書き出し形式
      </Text>
      <View style={styles.segment}>
        {formatOptions.map((option) => {
          const selected = format === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.segmentItem,
                {
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setFormat(option.key)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? theme.onPrimary : theme.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 会社名・現場名 */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {labels.exportSection ?? '書き出し情報'}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
          {labels.companyName ?? '会社名'}
        </Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={companyName}
          onChangeText={setCompanyName}
          onEndEditing={() => void updateSettings({ companyName })}
          placeholder="例: 株式会社サンプル"
          placeholderTextColor={theme.textSecondary}
        />
        <Text
          style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}
        >
          {labels.siteName ?? '現場名'}
        </Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          value={siteName}
          onChangeText={setSiteName}
          onEndEditing={() => void updateSettings({ siteName })}
          placeholder="例: ○○ビル新築工事"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.exportButton,
          { backgroundColor: theme.primary, opacity: exporting ? 0.6 : 1 },
        ]}
        onPress={() => void handleExport()}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color={theme.onPrimary} />
        ) : (
          <Text style={[styles.exportButtonText, { color: theme.onPrimary }]}>
            {format === 'csv'
              ? (labels.exportCSV ?? 'CSVで書き出す')
              : (labels.exportPDF ?? 'PDFで書き出す')}
          </Text>
        )}
      </TouchableOpacity>

      {picker && (
        <DateTimePicker
          value={picker === 'start' ? startDate : endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={handlePickerChange}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    paddingVertical: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 16,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  previewText: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  segment: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 13,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 6,
  },
  exportButton: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
