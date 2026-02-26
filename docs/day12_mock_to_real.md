# Day12 モック→実API差し替え手順（最終骨子）

## 1. 切替準備

1. MSW 起動条件（app/providers.tsx）
- `NEXT_PUBLIC_API_MOCK=on` のときのみ MSW を起動
- `NEXT_PUBLIC_MSW_LOG=off` で `worker.start` の quiet を有効化
- `next/public` の service worker 配置は既存のまま利用

2. 起動
- MSW有効: `NEXT_PUBLIC_API_MOCK=on` で `npm run dev`
- 実API接続: `NEXT_PUBLIC_API_MOCK=off`（または未設定）で `npm run dev`

3. API 基本方針
- 本資料時点の実呼び出しは相対パス（`/api/...`）。
- 将来の外部接続時は `NEXT_PUBLIC_API_BASE_URL` を追加して `src/utils/http.ts` の URL 結合箇所を変更する（実装は別タスク）。

4. 認証前提
- `middleware.ts`: auth cookie + role cookie による画面ガード。
- `api` 側は `username` cookie を owner 判定で利用（`/api/my/*` 系）。
- 将来 token 化する場合は middleware・http クライアント・API 側 owner 判定の同時差し替えが必要。

## 2. 差し替え順（推奨）

1. `NEXT_PUBLIC_API_MOCK=off` に変更し、開発サーバを再起動。
2. `day12_api_io.md` の 4 画面（/tools, /loan-box, /my-loans, /admin/returns）を参照し、必要ヘッダ/ボディを確認。
3. 事前に実API接続ログを有効化して 3 件の疎通チェックを順次実施。
4. 失敗時は戻しは `NEXT_PUBLIC_API_MOCK=on`。

## 3. 実API疎通最小チェック（最低3本）

- `GET /api/tools`
  - 期待: 200 + Tool 配列

- `POST /api/boxes/confirm`
  - Body 例
  - `{"startDate":"2026-02-01","dueDate":"2026-02-08","toolIds":["t1","t2"]}`
  - 期待: `{"ok":true,"boxId":"..."}`

- `POST /api/admin/returns/approve`
  - Body 例: `{"boxId":"b-xxxx","toolIds":["t1"]}`
  - 期待: 200、対象明細の消失（画面再取得で反映）

## 4. 補足（確認事項）

- `/api/admin/dev/reset` は `POST` 専用。ブラウザで GET で開くと 404（未定義）になるため、管理画面の実行ボタン経由のみ利用。
- `day12_error_policy.md` の 401/403/409/422/400/404 取扱いをそのまま適用して UI を確認。

