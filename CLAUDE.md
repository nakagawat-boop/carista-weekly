# CLAUDE.md — Carista Weekly Dashboard

## プロジェクト概要

キャリスター社のCA（キャリアアドバイザー）チーム向け週次KPIダッシュボード。
注力人数・面談設定数・面談数・稼働数・決定数・売上・平均単価・ズバ・CLのKPIを週単位で記録し、
CS/CSL別の管理、注力企業の選考歩留まり、PJ確認シートを一元管理する。

## 技術スタック

- **フレームワーク**: Next.js (App Router, `'use client'`)
- **言語**: TypeScript
- **DB/BaaS**: Supabase (`weekly_data`テーブル, JSON payload方式)
- **スタイリング**: Tailwind CSS + CSS変数 + インラインスタイル
- **デプロイ**: Vercel

## Supabase

- URL: `NEXT_PUBLIC_SUPABASE_URL` (.env.local)
- テーブル: `weekly_data` (week_key: string PK, payload: JSON)
- RLS: anon読み書き許可
- Realtime: `weekly_data`テーブルの変更をリアルタイム同期

## ディレクトリ構成

```
carista-weekly/
├── .claude/
│   └── agents/
│       ├── architect.md      # Architectエージェント定義
│       └── ai-designer.md    # AIDesignerエージェント定義
├── app/
│   ├── page.tsx              # メインUI — Generator が編集
│   ├── layout.tsx            # ルートレイアウト — 通常変更しない
│   ├── globals.css           # グローバルCSS — 通常変更しない
│   └── api/
│       ├── data/route.ts     # Supabase CRUD — Generator が編集
│       └── weeks/route.ts    # 週一覧取得 — Generator が編集
├── components/
│   ├── KpiCard.tsx           # KPIカードコンポーネント
│   └── LoginScreen.tsx       # ログイン画面コンポーネント
├── lib/
│   └── supabase.ts           # Supabaseクライアント — 通常変更しない
├── types/
│   └── index.ts              # 型定義 — Generator が最初に更新
├── package.json
├── next.config.js
├── tailwind.config.js
└── CLAUDE.md                 # このファイル
```

## 5エージェント自律開発構成（Planner → Architect → AIDesigner → Generator → Evaluator）

機能追加・変更時は以下の5段階で作業する。

### Planner（計画）
- ユーザー要件を分析し、変更箇所・影響範囲を特定する
- 既存機能への影響（回帰リスク）を事前に洗い出す
- 実装方針をユーザーに提示し、合意を得てから着手する

### Architect（設計） — `.claude/agents/architect.md`
- DB設計・API設計・技術スタック選定を担当
- 既存のSupabaseスキーマとAPIエンドポイントを読んで影響範囲を分析
- 実装詳細には踏み込まず「何をどう設計するか」だけを出力
- GeneratorへのハンドオフドキュメントをMarkdownで出力

### AIDesigner（UIデザイン） — `.claude/agents/ai-designer.md`
- UI/UXデザイン専門。既存デザインシステム（CSS変数トークン）に準拠
- 白背景+紫グラデーション+白カードの組み合わせは禁止（AIスロップ）
- 色の一貫性・タイポグラフィ・余白・コントラスト比を評価基準とする
- コンポーネント単位でTailwindクラス名まで具体的に指定してGeneratorに渡す

### Generator（実装）
- Architect・AIDesignerの設計書に基づきコードを変更する
- 変更は最小限に留め、関係ないコードを触らない
- 型定義(`types/index.ts`)を先に更新し、コンパイルエラーを防ぐ

### Evaluator（評価）
- `npm run build` でビルドエラーがないことを確認する
- 変更した機能が仕様通り動作することを検証する
- 既存タブ・既存機能が壊れていないことを確認する

## ファイル書き込み権限

**Planner** → CLAUDE.md、設計ドキュメントの更新のみ
**Architect** → 読み取り専用（設計書をMarkdownで出力、コード変更しない）
**AIDesigner** → 読み取り専用（デザイン仕様書を出力、コード変更しない）
**Generator** → app/, types/, lib/, components/ 配下のソースコード
**Evaluator** → 読み取り専用（ビルド・動作確認のみ、コード変更しない）

## 機能追加ワークフロー

### 1. 仕様確認（Planner）
- ユーザーの要件を正確に把握する
- 影響するタブ・データ構造・APIを特定する
- `types/index.ts` の型変更が必要か確認する

### 2. 設計（Architect）
- DB設計・API設計・型定義の変更を設計する
- 影響範囲と回帰リスクを分析する
- ハンドオフドキュメント（Markdown）を出力する

### 3. UIデザイン（AIDesigner）
- 既存デザインシステム（CSS変数トークン）に準拠してデザインする
- コンポーネント単位でTailwindクラス名まで指定する
- AIスロップを回避する

### 4. 実装（Generator）
- Architect・AIDesignerの設計書に基づき実装する
- 型定義を先に更新（`types/index.ts`）
- UIの変更（`app/page.tsx`、`components/`）
- API変更が必要なら対応するroute.tsを更新
- 変更は1つの論理単位ごとにコミットする

### 5. テスト・デプロイ（Evaluator）
- `npm run build` でビルド成功を確認
- 開発サーバー (`npm run dev`) で動作確認
- 変更した機能の正常動作を確認
- 他のタブ・機能への回帰がないことを確認

## 品質基準

| 基準 | チェック内容 |
|------|-------------|
| **機能完全性** | 要件で求められたすべての機能が実装されている |
| **動作安定性** | `npm run build` が成功し、ランタイムエラーが発生しない |
| **UI品質** | レイアウト崩れ・文字切れ・色の不整合がない |
| **回帰なし** | 既存の9タブすべてが変更前と同じように動作する |

## 絶対ルール

1. **既存機能を壊さない** — 変更前に影響範囲を確認し、関係ないコードは触らない
2. **本番デプロイ前にビルド確認** — `npm run build` が通らないコードをmainにマージしない
3. **型安全を維持** — `any`型の使用を避け、`types/index.ts`の型定義を正しく保つ
4. **環境変数を漏らさない** — `.env.local`はコミットしない（`.gitignore`で除外済み）
5. **最小限の変更** — 依頼された範囲のみ変更し、不要なリファクタリングをしない

## 主要データ構造

- **WeekData**: 週次データ全体（`types/index.ts`で定義）
- **week_key**: `YYYY_MM_NW` 形式のユニークキー
- **CAメンバー**: 中村（管理者）, 大城, 小谷, 喜多（4名）
- **KPI項目**: focusCount, interviewSet, meetings, active, decided, sales, zuba, cl
- **チャートライブラリ**: recharts（BarChart, ResponsiveContainer）
- **追加データ型**: CaTarget, CAKarte, CompanyCommitment, FbItem, StudyData, ShiryoItem

## タブ構成（9タブ）

0. **全体KPI** — CS+CSL合算の週次KPI表示、CA別実績チャート、CA別売上チャート
1. **CS / CSL別** — セグメント別のKPI入力・表示
2. **注力企業** — 企業別の選考歩留まり管理（書類→一次→二次→最終→内定→決定）
3. **PJ進捗** — プロジェクト管理（ステータス・担当者・期限付き）
4. **目標設定** — CA別8指標の目標値設定と達成率表示（管理者のみ編集可）
5. **同席FB** — 同席フィードバック記録（候補者・企業・CA・質問・回答）
6. **CAカルテ** — 離脱分析（9フェーズ別）・ランク別離脱・強み/弱み/改善計画・成長メモ
7. **企業コミット** — 月次コミット企業のファネル管理・転換率サマリー・落選記録・比較チャート
8. **勉強会** — 10分勉強会記録・次回予定・アクションアイテム・参考資料

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド（デプロイ前に必ず実行）
npm start        # 本番サーバー起動
```
