# data-design.md — CAメンバー追加（福田・清野）

**Agent 3: DataEngineer**
入力: docs/architecture.md

## マイグレーションSQL
**不要。** `weekly_data` のスキーマ（`week_key text PK`, `payload jsonb`）は不変。CAメンバーはpayload内の配列として表現されるため、DDL変更は発生しない。

## データ整合性
- **後方互換**: 既存週payload（CA4要素）は GET 時 `migrate()` が `CA_COUNT(=6)` まで `while (length < CA_COUNT)` でpad。福田・清野の行は `EMPTY_CA`（全KPI=0）／`EMPTY_TARGET`（既定目標）／`EMPTY_KARTE()` で補完。
- **既存データ保護**: `map(row => ({ ...EMPTY_CA, ...row }))` により既存4名の値は上書きされず保持。
- **二重管理の排除**: 旧実装はAPI側で配列を4要素ハードコードしていた。`CA_NAMES.length` 参照へ変更し、型定義と件数が常に一致するようにした（将来のCA増減も自動対応）。

## 正規化に関する注記
本テーブルはJSON payload集約方式のため第3正規形は適用対象外。CAメンバーはアプリ定数（`CA_NAMES`）で管理し、payloadは週次スナップショットとして保持する設計を踏襲。

## RLS
- 変更なし。`weekly_data` は anon 読み書き許可の既存ポリシーを維持。CA追加で新たなテーブル・ポリシーは発生しない。

## timestamptz / NULL
- 影響なし（payload内 `updatedAt` はISO文字列、既存仕様を踏襲）。
