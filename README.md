# WBGT Monitor（熱中症モニター）

> WBGT（暑さ指数）をリアルタイムで監視し、熱中症リスクを未然に防ぐ React Native / Expo アプリ。
> A React Native / Expo app that monitors WBGT (Wet Bulb Globe Temperature) in real time to help prevent heat-related illness.

---

## 概要 / Description

### プロジェクトGoal

**建設・製造業の中小企業における熱中症コンプライアンスの標準モバイルツール** になること。

- **目標**: 有料契約 1,000 社（MRR ¥3M）を 2 年以内に達成
- **市場**: 対象企業 ~80 万社、リスク労働者 ~760 万人
- **規制追い風**: 2021 年厚労省ガイドライン強化、気候変動による年々の暑熱リスク増大

### 価格ポリシー / Pricing Policy

**B2B（biz flavor）: 無料ティアなし。7 日間無料トライアルのみ。**

| プラン | 月額 | 年額 | ワーカー数 | 主な機能 |
|--------|------|------|-----------|---------|
| **ライト** | ¥3,000 | ¥29,800 | 10 人 | WBGT 監視 + アラート + 記録保存 + CSV |
| **スタンダード** | ¥10,000 | ¥98,000 | 50 人 | + チーム管理 + 帳票 + PDF + 複数現場 |
| **エンタープライズ** | ¥30,000 | ¥298,000 | 無制限 | + API 連携 + カスタムレポート + 専用サポート |

**Consumer flavor（熱中症アラート）: 完全無料**（広告なし）。B2C は認知拡大チャネル。

### 日本語

**WBGT Monitor（熱中症モニター）** は、現在地の気象データから WBGT（湿球黒球温度・暑さ指数）を推定し、5 段階のリスクレベルで熱中症の危険度を可視化するモバイルアプリです。気温・湿度・日射量・風速をもとに屋外 WBGT を算出し、危険水準に達した際には通知でユーザーに警告します。バックグラウンドでも定期的に監視を行うため、屋外作業や外出時の安全管理に役立ちます。

本アプリは **業務向け（biz）** と **一般向け（consumer）** の 2 つのフレーバーを単一コードベースから提供します。

### English

**WBGT Monitor** estimates the WBGT (Wet Bulb Globe Temperature / heat index) from local weather data and visualizes heat-stroke risk across five levels. It computes outdoor WBGT from temperature, humidity, solar radiation, and wind speed, and warns users via notifications when conditions become dangerous. Background monitoring keeps watch even while the app is closed, making it useful for outdoor work and everyday outings.

The app ships **two flavors** — **business (biz)** and **consumer** — from a single codebase.

---

## 主な機能 / Features

- **リアルタイム WBGT 表示** — 現在地の暑さ指数をゲージで可視化（`WbgtGauge`）。
- **24 時間予報** — 時間ごとの WBGT 推移をチャート表示（`HourlyChart`）。
- **5 段階リスク判定** — ほぼ安全 / 注意 / 警戒 / 厳重警戒 / 危険（環境省準拠の配色）。
- **しきい値通知** — 危険水準到達時にローカル通知でアラート（`expo-notifications`）。
- **バックグラウンド監視** — 定期的に WBGT をチェック（`expo-background-fetch` / `expo-task-manager`）。
- **位置情報連動** — 現在地を自動取得、取得失敗時は東京をフォールバック（`expo-location`）。
- **活動記録** — 作業・外出の開始/終了、講じた措置を SQLite に保存（`expo-sqlite`）。
- **CSV エクスポート** — 業務向けフレーバーのみ、記録を CSV 出力。
- **オフラインキャッシュ** — 天気 API レスポンスを 5 分キャッシュ、失敗時は指数バックオフで最大 3 回リトライ。
- **ダーク/ライト対応** — システム設定に追従（`userInterfaceStyle: automatic`）。

---

## デュアルフレーバー / Dual Flavor

単一のコードベースから、用途の異なる 2 つのアプリをビルドできます。フレーバーは環境変数 `APP_FLAVOR` で切り替えます。

| | **biz（業務向け）** | **consumer（一般向け）** |
|---|---|---|
| アプリ名 | 熱中症レコーダー Pro | 熱中症アラート |
| Slug | `wbgt-recorder-pro` | `wbgt-alert` |
| Bundle ID | `com.stagen.wbgt.biz` | `com.stagen.wbgt.consumer` |
| 開始ボタン | 作業開始 | 外出開始 |
| 終了ボタン | 作業終了 | 活動終了 |
| 記録セクション | 作業記録 | 活動ログ |
| 作業者数入力 | あり | なし |
| 措置ラベル | 講じた措置 | 熱中症対策メモ |
| CSV エクスポート | 有効 | 無効 |
| 活動プリセット | 屋外作業 / 建設作業 / 農作業 ほか | 散歩 / ランニング / スポーツ ほか |

フレーバーごとの文言は `i18n/biz.json` / `i18n/consumer.json`、定数は `src/utils/constants.ts` に定義されています。

---

## 技術スタック / Tech Stack

| カテゴリ | 採用技術 |
|---|---|
| フレームワーク | [Expo](https://expo.dev/) `~54.0` / React Native `0.81` / React `19.1` |
| 言語 | TypeScript `~5.9` |
| 状態管理 | [Zustand](https://github.com/pmndrs/zustand) `^5.0` |
| ナビゲーション | React Navigation（Native Stack / Bottom Tabs）`^7` |
| ローカル DB | `expo-sqlite` |
| 位置情報 | `expo-location` |
| 通知 | `expo-notifications` |
| バックグラウンド | `expo-background-fetch` / `expo-task-manager` |
| 描画 | `react-native-svg`（ゲージ・チャート） |
| 天気 API | [Open-Meteo](https://open-meteo.com/)（API キー不要） |
| ビルド/配布 | [EAS Build](https://docs.expo.dev/build/introduction/) |

---

## はじめに / Getting Started

### 前提条件 / Prerequisites

- **Node.js 18 以上**
- **Expo CLI**（`npx expo` 経由で利用可能）
- iOS シミュレータ（Xcode）または Android エミュレータ、もしくは実機 + Expo Go

### インストール / Installation

```bash
git clone <repository-url>
cd wbgt-monitor
npm install
```

### 起動 / Running

フレーバーを `APP_FLAVOR` で指定して起動します。

```bash
# 業務向け（biz）
APP_FLAVOR=biz npm start

# 一般向け（consumer）
APP_FLAVOR=consumer npm start
```

ショートカットスクリプトも利用できます。

```bash
npm run start:biz        # = APP_FLAVOR=biz expo start
npm run start:consumer   # = APP_FLAVOR=consumer expo start
```

その他のコマンド:

```bash
npm run ios         # iOS で実行
npm run android     # Android で実行
npm run web         # Web で実行
npm run lint        # ESLint
npm run typecheck   # 型チェック（tsc --noEmit）
```

---

## ビルド / Build

[EAS Build](https://docs.expo.dev/build/introduction/) のプロファイルがフレーバーごとに定義されています（`eas.json`）。

```bash
# 開発ビルド（development client）
eas build --profile development-biz
eas build --profile development-consumer

# プレビュー（社内配布）
eas build --profile preview-biz
eas build --profile preview-consumer

# 本番（autoIncrement 有効）
eas build --profile production-biz
eas build --profile production-consumer
```

| プロファイル | 配布 | flavor | 備考 |
|---|---|---|---|
| `development-*` | internal | biz / consumer | Development Client 付き |
| `preview-*` | internal | biz / consumer | 社内テスト配布 |
| `production-*` | store | biz / consumer | `autoIncrement: true` |

各プロファイルは `env.APP_FLAVOR` を介して対応するフレーバーをビルドします。ストア提出は `eas submit --profile production-biz` / `production-consumer` を使用します。

---

## プロジェクト構成 / Project Structure

```
wbgt-monitor/
├── app.config.ts          # Expo 動的設定（APP_FLAVOR でフレーバー切替）
├── eas.json               # EAS Build プロファイル定義
├── index.ts               # エントリポイント
├── i18n/
│   ├── biz.json           # 業務向け文言
│   └── consumer.json      # 一般向け文言
└── src/
    ├── components/         # UI コンポーネント
    │   ├── WbgtGauge.tsx       # WBGT ゲージ
    │   ├── HourlyChart.tsx     # 24 時間予報チャート
    │   └── RecordingSheet.tsx  # 記録入力シート
    ├── screens/            # 画面
    │   ├── HomeScreen.tsx
    │   ├── RecordScreen.tsx
    │   ├── RecordDetailScreen.tsx
    │   ├── SettingsScreen.tsx
    │   └── OnboardingScreen.tsx
    ├── navigation/         # ナビゲーション型定義
    ├── stores/             # Zustand ストア
    │   ├── wbgtStore.ts
    │   ├── recordStore.ts
    │   └── settingsStore.ts
    ├── services/           # ビジネスロジック / 外部連携
    │   ├── weatherApi.ts       # Open-Meteo クライアント
    │   ├── wbgtCalculator.ts   # WBGT 推定エンジン
    │   ├── locationService.ts  # 位置情報取得
    │   ├── notificationService.ts
    │   ├── backgroundTask.ts   # バックグラウンド監視
    │   ├── database.ts         # SQLite 永続化
    │   └── appInitializer.ts
    ├── hooks/              # カスタムフック（useTheme / useLabel）
    └── utils/
        └── constants.ts        # しきい値・色・既定設定
```

---

## データソースと推定方法 / Data Sources & Estimation

### 気象データ / Weather Data

気象データは [Open-Meteo Forecast API](https://open-meteo.com/) から取得します（**API キー不要・無料**）。

- エンドポイント: `https://api.open-meteo.com/v1/forecast`
- 取得項目: `temperature_2m`（気温）, `relative_humidity_2m`（相対湿度）, `direct_radiation`（直達日射量）, `wind_speed_10m`（風速）
- レスポンスは 5 分間メモリキャッシュ、失敗時は指数バックオフで最大 3 回リトライ。

### WBGT 推定式 / WBGT Estimation Formula

屋外（日射あり）の WBGT は標準式で算出します。

```
WBGT = 0.7 × Tw + 0.2 × Tg + 0.1 × Ta
```

- **Tw（湿球温度）** — Stull (2011) の経験式で推定
  *R. Stull, "Wet-Bulb Temperature from Relative Humidity and Air Temperature", J. Appl. Meteor. Climatol., 2011.*
- **Tg（黒球温度）** — 日射による昇温と風による冷却を単純化した熱収支近似
  `ΔTg = C × S / v^0.6`（S: 日射量, v: 風速, C: 経験係数）
- **Ta（気温）** — Open-Meteo の実測気温

#### リスクレベル / Risk Levels

WBGT 値に応じて 5 段階に分類します（環境省の暑さ指数に準拠した配色）。

| レベル | WBGT（℃） | ラベル | 色 |
|---|---|---|---|
| 1 | < 21 | ほぼ安全 | 🔵 青 `#2196F3` |
| 2 | 21 – 25 | 注意 | 🟢 緑 `#8BC34A` |
| 3 | 25 – 28 | 警戒 | 🟡 黄 `#FFEB3B` |
| 4 | 28 – 31 | 厳重警戒 | 🟠 橙 `#FF9800` |
| 5 | ≥ 31 | 危険 | 🔴 赤 `#F44336` |

> ⚠️ **注意 / Disclaimer**
> 本アプリの湿球温度・黒球温度はいずれも**推定値**です。厳密な WBGT は実測センサー（自然湿球温度計・黒球温度計）でのみ得られます。表示値はあくまで目安としてご利用ください。
> The wet-bulb and globe temperatures here are **estimates**. Accurate WBGT requires physical sensors. Use displayed values as a reference only.

---

## ライセンス / License

[MIT License](./LICENSE)

---

## 作者 / Author

**STAGEN**
