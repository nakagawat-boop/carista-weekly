# CLAUDE.md — Carista Weekly Dashboard

## プロジェクト概要

キャリスター社のCA（キャリアアドバイザー）チーム向け週次KPIダッシュボード。
注力人数・面談設定数・面談数・稼働数・決定数・売上・平均単価・ズバ・CLのKPIを週単位で記録し、
CS/CSL別の管理、注力企業の選考歩留まり、PJ確認シート、CAカルテ、企業コミットを一元管理する。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router, `'use client'`)
- **言語**: TypeScript
- **DB/BaaS**: Supabase (`weekly_data` テーブル, JSON payload方式)
- **スタイリング**: Tailwind CSS + CSS変数トークン + インラインスタイル
- **チャート**: recharts (BarChart, ResponsiveContainer)
- **デプロイ**: Vercel（mainブランチへのpushで自動デプロイ）

## デザインシステム（2026-04 リニューアル）

高級感あるダッシュボード。**白背景+紫グラデ+白カードは禁止（AIスロップ）**。

- **ベースカラー（Light 既定）**: オフホワイト `#F7F4EF` × 墨 `#17140E`。上質紙の質感（noise overlay）
- **ベースカラー（Dark）**: オフブラック `#0A0A0D` × `#F5EFE2`。ブラックカード風
- **プライマリ**: Carista Orange `#FF6B1F` → Copper `#B87333` のグラデーション (`--grad-orange-copper`)
- **セカンダリ**: Champagne Gold `#D4AF7A` + Gold → Bronze グラデーション (`--grad-gold-bronze`)
- **タイポグラフィ**:
  - Display/見出し: `Fraunces`, `Marcellus`, `Noto Serif JP` (FT的な大数字演出)
  - 本文: `Inter`, `Noto Sans JP`
  - 数字: `tabular-nums` 必須
- **レイアウト**: 左サイドバー 248px + トップバー（ロゴは使用しない。brandエリアはタイトル文字のみ）
- **角丸**: カード `--r-3` (6px)、ボタン `--r-2` (4px)、pill `--r-pill`。角は控えめ
- **ヘアライン**: `var(--line-1)` 境界で区切る。`box-shadow` は最小限に
- **ノイズテクスチャ**: `.tex-noise` で紙/炭の質感を載せる

CSS変数・設計トークンは `app/globals.css` に一元定義。色はハードコードせず変数参照。

## Supabase

- URL: `NEXT_PUBLIC_SUPABASE_URL` (`.env.local`)
- テーブル: `weekly_data` (`week_key: string` PK, `payload: JSON`)
- RLS: anon読み書き許可
- Realtime: `weekly_data` テーブルの変更をリアルタイム同期

## ディレクトリ構成

```
carista-weekly/
├── .claude/agents/           # 5エージェント定義
├── app/
│   ├── page.tsx              # メインUI — Generator が編集
│   ├── layout.tsx            # ルートレイアウト（フォント読込含む）
│   ├── globals.css           # デザイントークン + グローバルCSS
│   └── api/
│       ├── data/route.ts     # Supabase CRUD
│       └── weeks/route.ts    # 週一覧取得
├── components/
│   ├── KpiCard.tsx           # KPIカード（メトリック）
│   └── LoginScreen.tsx       # ログイン画面
├── lib/supabase.ts           # Supabaseクライアント
├── types/index.ts            # 型定義（Generator が最初に更新）
├── package.json
├── tailwind.config.js
└── CLAUDE.md
```

## 5エージェント自律開発構成

機能追加・変更時は **Planner → Architect → AIDesigner → Generator → Evaluator** の順で作業する。

### Planner（計画）
- ユーザー要件を分析し、変更箇所・影響範囲を特定
- 既存機能への回帰リスクを事前洗い出し
- 実装方針を提示

### Architect（設計） — `.claude/agents/architect.md`
- DB設計・API設計・型定義を担当
- 既存Supabaseスキーマ・APIエンドポイント・型 (`types/index.ts`) を読んで影響分析
- 実装詳細には踏み込まず「何をどう設計するか」だけを出力

### AIDesigner（UIデザイン） — `.claude/agents/ai-designer.md`
- 上記デザインシステム（CSS変数トークン）に準拠
- **禁止**: 白+紫グラデ+白カードのAIスロップ配色
- 色・タイポ・余白・コントラスト比を評価
- Tailwindクラス/CSS変数名まで具体的に指定

### Generator（実装）
- 設計書に基づきコード変更。変更は最小限
- `types/index.ts` を先に更新しコンパイルエラーを防ぐ
- UI変更は `app/page.tsx` / `components/` / `app/globals.css` を触る
- API変更が必要なら対応する `route.ts` を更新

### Evaluator（評価）
- `npm run build` でビルド成功を確認
- 変更機能が仕様通り動作するか検証
- 既存9タブ＋ログイン＋保存/読込/Realtime が壊れていないか確認

## ファイル書き込み権限

| エージェント | 権限 |
|----|----|
| Planner | CLAUDE.md・設計ドキュメントのみ |
| Architect | 読み取り専用（Markdown出力のみ） |
| AIDesigner | 読み取り専用（デザイン仕様書出力のみ） |
| Generator | `app/`, `types/`, `lib/`, `components/` 配下 |
| Evaluator | 読み取り専用（ビルド・動作確認のみ） |

## 絶対ルール

1. **既存機能を壊さない** — 変更前に影響範囲を確認、関係ないコードは触らない
2. **本番デプロイ前にビルド確認** — `npm run build` が通らないコードをmainにマージしない
3. **型安全を維持** — `any` 型を避け、`types/index.ts` を正しく保つ
4. **環境変数を漏らさない** — `.env.local` はコミットしない
5. **最小限の変更** — 依頼範囲のみ変更、不要なリファクタリングをしない
6. **デザイントークン準拠** — 色はCSS変数から引く。ハードコード禁止
7. **Light/Darkテーマ対応** — `data-theme="dark"` で両対応

## 主要データ構造

- **WeekData**: 週次データ全体（`types/index.ts`）
- **week_key**: `YYYY_MM_NW` 形式のユニークキー
- **CAメンバー**: 中村（管理者）・大城・小谷・喜多（4名）
- **KPI項目**: `focusCount`, `interviewSet`, `meetings`, `active`, `decided`, `sales`, `zuba`, `cl`
- **追加データ型**: `CaTarget`, `CAKarte`, `CompanyCommitment`, `FbItem`, `StudyData`, `ShiryoItem`, `PjCard`, `FocusRow`

## タブ構成（7タブ）

| ID | タイトル | 概要 |
|----|----|----|
| `overall` | 全体KPI | CS+CSL合算の週次KPI・CA別実績/売上チャート |
| `cscsl` | CS / CSL 別 | セグメント別KPI入力・表示 |
| `pj` | PJ進捗 | プロジェクト管理（ステータス/担当者/期限付き） |
| `target` | 目標設定 | CA別8指標の目標値設定・達成率（管理者のみ編集可） |
| `feedback` | 同席FB | 同席フィードバック記録 |
| `karte` | CAカルテ | 離脱分析・強み/弱み/改善・成長メモ |
| `commit` | 企業コミット | 月次コミット企業のファネル・落選記録・比較チャート |

（旧9タブ構成から「注力企業」「勉強会」を削除済み）

## 開発コマンド

```bash
npm run dev      # 開発サーバー (http://localhost:3000)
npm run build    # 本番ビルド（デプロイ前に必ず実行）
npm start        # 本番サーバー起動
```

## デプロイフロー

`git push origin main` → Vercel が自動ビルド・デプロイ → `https://carista-weekly.vercel.app/` に反映。
