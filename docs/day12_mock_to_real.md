# Day12 モック→実API差し替え手順（最終骨子）

## 目的
- `NEXT_PUBLIC_API_MOCK=on/off` を切り替えて、MSW接続から実API接続へ確実に切り替える。
- `day12_api_io.md` の必須/任意項目と `day12_error_policy.md` のエラー方針を使い、最小疎通を順番どおり検証する。

## 1. 事前準備（命令手順）

1. `app/providers.tsx` の方針に従い環境変数を確認する。
   - `NEXT_PUBLIC_API_MOCK=on` のときのみ MSW を起動。
   - `NEXT_PUBLIC_MSW_LOG=off` のときのみ `worker.start` を quiet にする。
   - Service Worker は既存 `public/mockServiceWorker.js` をそのまま利用する。

2. `docs/day12_api_io.md` と `docs/day12_error_policy.md` を参照して、呼び出す API とエラー時挙動を確認する。

3. 開発サーバを再起動前提で停止する。

## 2. 実API差し替え手順（確定順）

1. `.env.local` で `NEXT_PUBLIC_API_MOCK=off` を明示する（または `on` を削除）。
2. 開発サーバを停止してから再起動する。
   - 既に起動中なら `Ctrl+C` で停止する。
   - `npm run dev`
3. 画面を開き、DevTools を監視する。
   - Network タブ: フィルタ `Fetch/XHR`
   - `status` と `Response`（Body）を必ず確認
   - Console タブ: 例外が出たら `HttpError` の `status` / `message` を確認
4. 以下の順で最小疎通チェックを実施する。

## 3. 疎通確認観測点

- Browser DevTools
  - Network の `Status`（HTTPステータス）を確認。
  - `Response` を開き、`ok`、`boxId`、`message` を確認。
- Console
  - `apiFetchJson` は失敗時に例外を throw するため、
    `status` と `message` がログに残っているか確認する。

## 4. 最小疎通チェック（成立順で実施）

1. `GET /api/tools`
   - 期待: 200
   - 期待 Body: ツール配列

2. `POST /api/boxes/confirm`
   - 例: `{"startDate":"2026-02-01","dueDate":"2026-02-08","toolIds":["t1","t2"]}`
   - 期待: 200、`boxId` が返る

3. `POST /api/my/returns/request`
   - 例: `{"boxId":"<上記で作成したboxId>","toolId":"t1"}`
   - 期待: 200、管理者側の requested が生成されること（`/admin/returns` 取得時に対象が見える）

4. `POST /api/admin/returns/approve`
   - 例: `{"boxId":"<対象boxId>","toolIds":["t1"]}`
   - 期待: 200、管理者画面の `requested` 一覧から対象明細が消える

## 5. 409 / 422 再現手順（意図的な失敗確認）

- 409 を再現（競合）
  1. `/loan-box` で `available` 以外（`loaned` など）の `toolId` を混ぜる。
  2. Confirm 実行。
  3. 返却: 409（業務エラー）を確認し、画面が壊れないことを確認。

- 422 を再現（入力エラー）
  1. `/loan-box` で `dueDate < startDate` を指定して Confirm。
  2. `toolIds` を空で送信。
  3. 日付形式を不正に壊す。
  4. 返却: 422 を確認し、入力欄近傍（又は上部のエラー表示）に表示する。

## 6. 失敗時の戻し手順

- 失敗したら即座に `NEXT_PUBLIC_API_MOCK=on` に戻して `npm run dev` 再起動し、必要なら `Application → Service Workers → Unregister` を実施、または `Hard Reload` する。

## 7. 補足

- `/api/admin/dev/reset` は POST 専用。ブラウザで GET で開くと 404 になるため、管理画面の実行ボタン経由のみ利用。
- API仕様とエラー方針は `day12_api_io.md` / `day12_error_policy.md` の記載をそのまま適用する。
