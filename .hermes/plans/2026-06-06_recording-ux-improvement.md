# 作業記録 UX 改善計画

## 現状の問題

```
[作業開始] → Modal(フルスクリーン) → 他のメニュー操作不可 → [作業終了]
```

- 作業開始を押すと即座にフルスクリーンModalが表示される
- Modal表示中は他の画面（設定、記録一覧、エクスポート）に遷移不可
- 作業種別・作業者数は記録開始「後」にModalの中で入力する構造
- 経過アラートへの対応フローが無い

## 改善コンセプト

**「記録中」をアプリ全体のグローバル状態として、最小限のインジケーター（フローティングバー）で表現。必要時にフルシートを展開。**

```
[作業開始] → 入力ダイアログ(種別・人数) → フローティングバー(最小化状態)
                                              ↓ タップで展開
                                          ボトムシート(経過・措置・終了)
                                              ↓ アラート発生時
                                          警告モーダル(措置選択→作業再開/中断)
```

## 画面フロー詳細

### Phase 1: 作業開始

```
HomeScreen
  └─ [作業開始] ボタン押下
       └─ StartRecordingModal (ハーフシート)
            ├─ 作業種別 選択 (chip + 自由入力)
            ├─ 作業者数 入力 (bizのみ)
            └─ [記録開始] ボタン
                 → DB保存 → Modal閉じる → フローティングバー表示
```

### Phase 2: 記録中 (通常状態)

```
HomeScreen (通常通り操作可能)
  ├─ 全タブ/メニュー操作可能
  └─ RecordingFloatingBar (画面下部に常時表示)
       ├─ 経過時間 "1:23:45"
       ├─ 現在WBGT "28.5℃" (色付き)
       ├─ [▼] 展開ボタン → ボトムシートを表示
       └─ [■] 終了ボタン → 確認ダイアログ → 作業終了
```

- FloatingBarはタブナビゲーションの上に表示
- 他の画面(設定/記録一覧/エクスポート)でも表示され続ける
- タップで展開 → フルRecordingSheet表示

### Phase 3: 展開状態 (ボトムシート)

```
RecordingSheet (スワイプで閉じれるボトムシート)
  ├─ 経過時間 / 現在WBGT / 最大WBGT
  ├─ 作業種別 (変更可能)
  ├─ 作業者数 (変更可能, bizのみ)
  ├─ 講じた措置チェックリスト
  ├─ メモ
  ├─ [最小化] → FloatingBarに戻る
  └─ [作業終了] → 確認ダイアログ → 完了
```

### Phase 4: 警告アラート発生時

```
WBGT閾値超過検出 (ポーリング or バックグラウンド)
  └─ AlertActionModal (ハーフシート, 自動表示)
       ├─ "⚠️ WBGT 31.2℃ — 危険"
       ├─ 措置選択 (チェックリスト)
       │    □ 休憩確保
       │    □ 水分・塩分補給
       │    □ 作業時間短縮
       │    □ WBGT低減措置
       ├─ [作業中断] → 一時停止状態に移行
       └─ [措置を記録して継続] → 措置をDB保存 → 閉じる
```

### Phase 5: 一時中断 / 再開

```
一時中断状態:
  └─ RecordingFloatingBar (色変更: グレー/オレンジ)
       ├─ "中断中 (12:34から)"
       ├─ [▶] 作業再開ボタン
       └─ [■] 作業終了ボタン

作業再開:
  └─ [▶] 押下 → 即座に再開 (経過時間は中断時間を除外)
```

## データモデル変更

### records テーブル追加カラム

```sql
ALTER TABLE records ADD COLUMN pausedDuration INTEGER DEFAULT 0;
-- 中断時間の合計(秒)。実作業時間 = (endTime - startTime) - pausedDuration
```

### 新規テーブル: record_events

```sql
CREATE TABLE record_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recordId INTEGER NOT NULL,
  eventType TEXT NOT NULL,  -- 'alert' | 'pause' | 'resume' | 'measure'
  timestamp TEXT NOT NULL,
  wbgt REAL,
  data TEXT,  -- JSON: { measures: [...], reason: "..." }
  FOREIGN KEY (recordId) REFERENCES records(id) ON DELETE CASCADE
);
```

### recordStore 状態追加

```typescript
interface RecordState {
  // 既存
  isRecording: boolean;
  currentRecord: WorkRecord | null;

  // 追加
  isPaused: boolean;          // 一時中断中
  pausedAt: string | null;    // 中断開始時刻(ISO)
  pausedDuration: number;     // 累積中断時間(秒)
  sheetVisible: boolean;      // ボトムシート展開状態
  alertPending: boolean;      // 警告モーダル表示中

  // 新アクション
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  recordAlert: (measures: string[]) => Promise<void>;
  toggleSheet: () => void;
}
```

## コンポーネント構成

```
src/components/
  ├─ StartRecordingModal.tsx     [NEW] 開始時入力(種別/人数)
  ├─ RecordingFloatingBar.tsx    [NEW] 最小化バー
  ├─ RecordingSheet.tsx          [MODIFY] 展開シート(Modal→Sheet)
  ├─ AlertActionModal.tsx        [NEW] 警告時措置選択
  └─ (既存コンポーネント)
```

## 実装ステップ

### Step 1: データモデル拡張
- [ ] database.ts: record_events テーブル追加、pausedDuration カラム追加
- [ ] recordStore.ts: isPaused, pausedAt, pausedDuration 状態追加

### Step 2: StartRecordingModal
- [ ] 新コンポーネント作成: 作業種別選択 + 作業者数入力
- [ ] HomeScreenの「作業開始」ボタン → StartRecordingModalを表示
- [ ] 「記録開始」押下で startRecording(activityType, workerCount) 呼び出し

### Step 3: RecordingFloatingBar
- [ ] 新コンポーネント: 経過時間 + 現在WBGT + 展開/終了ボタン
- [ ] App.tsx (またはnavigation層) にグローバル配置
- [ ] タブバーの上に表示 (position: absolute + bottomオフセット)

### Step 4: RecordingSheet 改修
- [ ] Modal → react-native-reanimated-bottom-sheet or 自前Sheet
- [ ] 最小化ボタン追加 (sheetVisible=false → FloatingBar表示)
- [ ] 作業種別/人数を変更可能な状態で表示

### Step 5: 一時中断/再開
- [ ] pauseRecording: isPaused=true, pausedAt=now, event保存
- [ ] resumeRecording: pausedDuration加算, isPaused=false, event保存
- [ ] FloatingBarの表示切替 (記録中/中断中)
- [ ] 経過時間計算から中断時間を除外

### Step 6: AlertActionModal
- [ ] WBGT閾値超過時に alertPending=true → モーダル表示
- [ ] 措置チェック → record_eventsに保存
- [ ] 「作業中断」→ pauseRecording呼び出し
- [ ] 「措置を記録して継続」→ イベント保存して閉じる

### Step 7: 統合テスト・調整
- [ ] フロー全体の動作確認
- [ ] consumer flavor でも正常動作確認
- [ ] 中断→再開→アラート→再中断 のシナリオ検証

## ファイル変更リスト

| ファイル | 変更内容 |
|---------|---------|
| src/services/database.ts | record_events テーブル, pausedDuration |
| src/stores/recordStore.ts | 状態追加, pause/resume/alert アクション |
| src/components/StartRecordingModal.tsx | **新規** |
| src/components/RecordingFloatingBar.tsx | **新規** |
| src/components/AlertActionModal.tsx | **新規** |
| src/components/RecordingSheet.tsx | Modal→Sheet, 最小化対応 |
| src/screens/HomeScreen.tsx | ボタン→Modal呼び出し, FloatingBar統合 |
| App.tsx or navigation層 | FloatingBarのグローバル配置 |
| src/utils/constants.ts | 中断関連定数追加 |

## UX 判断ポイント

| 選択肢 | 採用案 | 理由 |
|--------|--------|------|
| 記録中UI | FloatingBar + 展開Sheet | 他メニュー操作可能、情報は常時見える |
| 開始時入力 | ハーフシートModal | フルスクリーン不要。2項目なら軽量 |
| 中断/再開 | FloatingBar上のボタン | 最小タップで操作。長押し不要 |
| アラート措置 | 自動モーダル表示 | ユーザーが気づかないリスク排除 |
| 経過時間 | 中断時間除外 | 実作業時間が義務記録対象 |

## リスク・注意点

- **react-native-reanimated** は追加依存になる → 自前で簡易Sheetを実装する方がシンプル（Animated.View + PanResponder）
- FloatingBarがタブバーと干渉しないよう bottom offset を適切に設定
- バックグラウンドでのアラート: expo-notifications が既に通知送信対応済み。フォアグラウンド復帰時にAlertActionModalを表示
- record_events テーブルはマイグレーション対応（既存DBにALTER TABLE）
