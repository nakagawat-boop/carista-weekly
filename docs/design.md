# design.md — CAメンバー追加（福田・清野）

**Agent 4: AIDesigner**
入力: docs/spec.md + docs/architecture.md

## 結論
新規UIコンポーネントは不要。既存コンポーネントが `CA_NAMES.map()` 駆動のため、配列拡張でレイアウトは自動追従する。デザイントークン（CSS変数）準拠は維持され、**白背景+紫グラデ+白カードのAIスロップは発生しない**。

## 影響コンポーネントとレイアウト検証
| コンポーネント | 描画 | 6名時の挙動 |
|---|---|---|
| LoginScreen | `members`(管理者除く5名)を 2カラムグリッド `gridTemplateColumns:'1fr 1fr'` | 大城・小谷／喜多・福田／清野 と3行に折返し。余白・角丸 `--r-3` 維持 |
| CaTable（KPI入力） | `CA_NAMES.map` で `<tbody>` 行追加 | 6行に増加。`tabular-nums` 維持 |
| TargetTab | `auto-fill, minmax(340px,1fr)` グリッド | カード6枚に自動増。崩れなし |
| CAKarteTab | `flex gap-2` のpillボタン群 | 6ボタン。必要に応じ折返し、`--r-pill` 維持 |
| FeedbackTab | 担当者 `<select>` に `CA_NAMES` | 6選択肢に増 |
| 全体KPIチャート | recharts `caChartData`/`salesChartData` | 棒6本に増。横幅は ResponsiveContainer が吸収 |

## カラー / タイポ / コントラスト
- 配色はすべて既存トークン参照（`--grad-orange-copper` / `--ink-*` / `--line-*`）。ハードコード追加なし。
- 数字は `tabular-nums`、見出しは `--font-display/serif` を継続。
- Light/Dark 両テーマで既存と同等のコントラストを維持（新規色なし）。

## 状態（hover/focus/disabled/空/ローディング）
- 既存の `.btn--ghost`/`.btn--primary` の状態スタイルをそのまま適用。新規状態定義は不要。
