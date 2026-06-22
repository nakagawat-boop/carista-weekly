# security-review.md — CAメンバー追加（福田・清野）

**Agent 6: SecurityReviewer**
入力: types/index.ts, app/api/data/route.ts, components/LoginScreen.tsx
判定: **PASS**

## 認証・認可
- 本アプリはユーザー選択式の簡易認証 + Supabase anon RLS（`weekly_data` 読み書き許可）。CA追加は新たな権限境界を導入しない。
- POST の `caIndex` 経路: `caIndex` は `CA_NAMES.indexOf(user)` 由来で 0..5 に収まり、`migrate()` が配列を `CA_COUNT` までpad済みのため範囲外書き込みは発生しない。✅
- 管理者権限（`ADMIN='中村'`）は不変。福田・清野は一般CA権限（自分の行のみ編集）。✅

## 入力検証
- CA名は定数 `CA_NAMES`（ユーザー入力ではない）。SQLインジェクション・XSSの新規面なし。✅
- payloadはSupabaseクライアント経由のパラメータバインドで保存。文字列連結クエリなし。✅

## 情報漏洩
- GETの `select('*')` を `select('week_key,payload')` に是正。不要フィールド露出の余地を排除。✅
- エラーメッセージは `error.message` のみ返却、内部スタック非露出（既存仕様）。
- 環境変数は `process.env` 参照のみ。console.log出力なし。✅

## その他
- open redirect / CSRF: 対象機能に該当なし（フォームPOSTでなくfetch JSON）。
- Rate limiting: 既存方針を踏襲（本変更で新規エンドポイントなし）。

## 所見（本変更の範囲外・記録のみ）
- なし。
