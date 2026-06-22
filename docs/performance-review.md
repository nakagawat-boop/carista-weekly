# performance-review.md — CAメンバー追加（福田・清野）

**Agent 7: PerformanceReviewer**
入力: types/index.ts, app/api/data/route.ts, app/page.tsx
判定: **PASS**

## DB
- N+1クエリ: なし。GETは対象週1クエリ + 新規週時のみ直前週1クエリ。CA数に依存しない。✅
- **SELECT \* 禁止**: GETの `select('*')` を `select('week_key,payload')` に是正。必須カラムのみ取得。✅
- インデックス: `week_key` がPK。WHERE句（`eq('week_key')` / `lt('week_key')`）をカバー。✅

## React / Next.js
- 再描画: CA行が4→6に増加するが、`CA_NAMES.map()` の純粋な反復で軽微。useEffect依存配列の変更なし。✅
- Server/Client分離: 変更は定数追加とAPIロジックのみ。コンポーネント境界に影響なし。✅
- 画像: 本変更で画像追加なし（next/image該当なし）。

## API
- 同一API多重呼び出し: なし。週切替時の単発fetchを踏襲。✅
- 補完処理 `migrate()`: `CA_COUNT(6)` 回の固定長ループ。計算量は定数オーダー。✅

## Warning（記録のみ・差し戻し対象外）
- なし。
