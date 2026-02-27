# Day12 API I/O 仕様（handlers.ts 抽出ベース）

本文は src/mocks/handlers.ts を仕様元とし、コード上に存在しない項目は「要確認」と明示します。/api/* は middleware.ts の matcher で除外されるため、APIレベルの 401/403 は本来未定義です。UI導線としての扱いは day12_error_policy.md 参照。

## /tools

### a. 画面目的
登録済み工具の一覧取得、倉庫・状態・検索条件で表示を整える。

### b. 呼ぶAPI一覧
- GET /api/tools
- GET /api/warehouses

### c. Request I/O

#### GET /api/tools
- クエリ: なし
- ボディ: なし
- クッキー: なし
- 必須: なし
- 任意: なし

#### GET /api/warehouses
- クエリ: なし
- ボディ: なし
- クッキー: なし
- 必須: なし
- 任意: なし

### d. Response I/O

#### GET /api/tools 200
Tool[]

型
- id: string
- name: string
- assetNo: string
- warehouseId: string
- status: available | loaned | repairing | lost

例
```json
[
  { "id": "t1", "name": "ドリル01", "assetNo": "A-0001", "warehouseId": "w1", "status": "available" }
]
```

#### GET /api/warehouses 200
Warehouse[]

型
- id: string
- name: string

例
```json
[
  { "id": "w1", "name": "第一倉庫" },
  { "id": "w2", "name": "第二倉庫" }
]
```

### e. Errors
- handlers での 401/403/400/404/409/422 は未定義
- UI導線としては day12_error_policy.md を参照

## /loan-box

### a. 画面目的
選択工具を貸出確定し、ボックスを作成する。開始日・返却期限・工具単位の期限上書きを送る。

### b. 呼ぶAPI一覧
- GET /api/tools
- GET /api/warehouses
- POST /api/boxes/confirm

### c. Request I/O

#### POST /api/boxes/confirm
ボディ: JSON

必須
- startDate: string（YYYY-MM-DD）
- dueDate: string（YYYY-MM-DD）
- toolIds: string[]

任意
- dueOverrides?: Record<string, string>

条件
- startDate/dueDate のみ受理し、dueDate >= startDate
- toolIds 空不可
- dueOverrides は toolId をキーとした date 文字列のペアのみ採用（形式不正キーは無視）

クッキー
- username は任意（未設定時は既定ユーザー名）

例
```json
{
  "startDate": "2026-02-01",
  "dueDate": "2026-02-08",
  "toolIds": ["t1", "t3"],
  "dueOverrides": {
    "t1": "2026-02-07"
  }
}
```

### d. Response I/O

#### POST /api/boxes/confirm 200
- { ok: boolean, boxId: string }

例
```json
{ "ok": true, "boxId": "b-1700000000000" }
```

### e. Errors
| status | 条件 |
|---|---|
| 422 | startDate/dueDate 未入力、形式不正、dueDate < startDate、toolIds 空、または dueOverrides が範囲外 |
| 404 | toolIds 内の toolId 不存在 |
| 409 | いずれかの tool が available 以外 |
| 400 | dueOverrides に未選択 toolId を含む |

UI挙動: day12_error_policy.md

## /my-loans

### a. 画面目的
自ユーザの open ボックスを取得し、工具単位で返却申請する。

### b. 呼ぶAPI一覧
- GET /api/my/boxes?status=open
- GET /api/warehouses
- POST /api/my/returns/request

### c. Request I/O

#### GET /api/my/boxes?status=open
- クエリ: status=open | all（未指定は open）
- ボディ: なし
- クッキー: username

#### POST /api/my/returns/request
- ボディ: JSON

必須
- boxId: string
- toolId: string

例
```json
{
  "boxId": "b-1700000000000",
  "toolId": "t1"
}
```

### d. Response I/O

#### GET /api/my/boxes 200
MyBox[]（box + items）

型（要点）
- box.id: string
- box.ownerUsername: string
- box.boxNo: number
- box.startDate: string（YYYY-MM-DD）
- box.dueDate: string（YYYY-MM-DD）
- box.status: open | closed
- items[].toolId: string
- items[].toolName: string
- items[].assetNo: string
- items[].warehouseId: string
- items[].dueOverride?: string
- items[].dueEffective: string
- items[].status: available | loaned | repairing | lost
- items[].returnStatus?: none | requested | approved
- items[].requestedAt?: string

例
```json
[
  {
    "box": {
      "id": "b-1700000000000",
      "ownerUsername": "user1",
      "boxNo": 1,
      "startDate": "2026-02-01",
      "dueDate": "2026-02-08",
      "status": "open"
    },
    "items": [
      {
        "boxId": "b-1700000000000",
        "toolId": "t1",
        "toolName": "ドリル01",
        "assetNo": "A-0001",
        "warehouseId": "w1",
        "dueOverride": "2026-02-07",
        "dueEffective": "2026-02-07",
        "status": "loaned",
        "returnStatus": "requested",
        "requestedAt": "2026-02-02T01:23:45.000Z"
      }
    ]
  }
]
```

#### POST /api/my/returns/request 200
- { ok: true }

### e. Errors
| status | 条件 |
|---|---|
| 422 | boxId または toolId 未入力 |
| 403 | box.ownerUsername と username cookie 不一致 |
| 404 | box 不在、tool が box に紐付かない、あるいは returnRequests 該当なし |
| 400 | box.status が open 以外 |
| 409 | 該当申請が requested または approved |

UI挙動: day12_error_policy.md

## /admin/returns

### a. 画面目的
返却申請中を box 単位で一覧化し、一括承認/部分承認を行う。

### b. 呼ぶAPI一覧
- GET /api/admin/returns
- GET /api/warehouses
- POST /api/admin/returns/approve

### c. Request I/O

#### GET /api/admin/returns
- クエリ: なし
- ボディ: なし

#### POST /api/admin/returns/approve
- ボディ: JSON

必須
- boxId: string

任意
- toolIds?: string[]（未指定時は requested 全件）

例
```json
{
  "boxId": "b-1700000000000"
}
```
```json
{
  "boxId": "b-1700000000000",
  "toolIds": ["t1", "t3"]
}
```

### d. Response I/O

#### GET /api/admin/returns 200
AdminReturnGroup[]（requested のみ）

型
- boxId: string
- ownerUsername: string
- boxNo: number
- startDate: string
- dueDate: string
- items: Array<{ toolId, toolName, assetNo, warehouseId, dueOverride?: string, dueEffective, requestedAt: string }>

例
```json
[
  {
    "boxId": "b-1700000000000",
    "ownerUsername": "user1",
    "boxNo": 1,
    "startDate": "2026-02-01",
    "dueDate": "2026-02-08",
    "items": [
      {
        "toolId": "t1",
        "toolName": "ドリル01",
        "assetNo": "A-0001",
        "warehouseId": "w1",
        "dueOverride": "2026-02-07",
        "dueEffective": "2026-02-07",
        "requestedAt": "2026-02-02T01:23:45.000Z"
      }
    ]
  }
]
```

#### POST /api/admin/returns/approve 200
- { ok: true, boxId: string, toolIds: string[] }

```json
{ "ok": true, "boxId": "b-1700000000000", "toolIds": ["t1"] }
```

### e. Errors
| status | 条件 |
|---|---|
| 422 | boxId 未入力 |
| 404 | box 不在、または requested が1件もない |
| 400 | box.status が closed |
| 409 | toolIds 指定時に requested 外アイテムが混在 |

UI挙動: day12_error_policy.md

## /api/reservations/confirm

### a. 画面目的
予約を作成する。

### b. 呼ぶAPI一覧
- POST /api/reservations/confirm

### c. Request I/O

#### POST /api/reservations/confirm
ボディ: JSON

必須
- startDate: string（YYYY-MM-DD）
- dueDate: string（YYYY-MM-DD）
- toolIds: string[]（1件以上）

任意
- なし

例
```json
{
  "startDate": "2026-02-01",
  "dueDate": "2026-02-08",
  "toolIds": ["t1", "t3"]
}
```

### d. Response I/O

#### POST /api/reservations/confirm 200
- { ok: true, reservationIds: string[] }

例
```json
{ "ok": true, "reservationIds": ["r-01", "r-02"] }
```

### e. Errors
| status | 条件 |
|---|---|
| 422 | startDate/dueDate 形式不正、未入力、dueDate < startDate、toolIds 空 |
| 409 | 同一 tool_id で既存 open 予約と期間重複 |
| 404 | 対象 tool が存在しない |

UI挙動: day12_error_policy.md

## /admin/tools

### a. 画面目的
ツールの一覧取得・追加・編集・削除。

### b. 呼ぶAPI一覧
- GET /api/admin/tools
- GET /api/admin/warehouses
- POST /api/admin/tools
- PATCH /api/admin/tools/:id
- DELETE /api/admin/tools/:id

### c. Request I/O（要点）

#### POST /api/admin/tools
必須
- name: string
- warehouseId: string

任意
- assetNo: string
- status: available | loaned | repairing | lost

#### PATCH /api/admin/tools/:id
任意だが1項目以上必須
- name?
- assetNo?
- warehouseId?
- status?

### d. Response I/O（要点）
- GET: Tool[]
- POST: { ok: true, tool: Tool }
- PATCH: { ok: true, tool: Tool }
- DELETE: { ok: true }

### e. Errors
- POST 400: name 未入力 / warehouseId 未入力
- POST 404: warehouseId 不在
- PATCH 422: 更新項目未指定、name または assetNo が空
- PATCH 404: 対象ツールなし
- DELETE 404: 対象ツールなし

## /admin/warehouses

### a. 画面目的
倉庫の一覧取得・追加・編集・削除。

### b. 呼ぶAPI一覧
- GET /api/admin/warehouses
- POST /api/admin/warehouses
- PATCH /api/admin/warehouses/:id
- DELETE /api/admin/warehouses/:id

### c. Request I/O（要点）
- POST: name 必須
- PATCH: name 必須

### d. Response I/O（要点）
- GET: Warehouse[]
- POST: { ok: true, warehouse: Warehouse }
- PATCH: { ok: true, warehouse: Warehouse }
- DELETE: { ok: true }

### e. Errors
- POST 400: name 空
- PATCH 404: id 不在
- PATCH 422: name 空
- DELETE 404: id 不在

## /admin/users

### a. 画面目的
ユーザーの一覧取得・追加・編集・削除。

### b. 呼ぶAPI一覧
- GET /api/admin/users
- POST /api/admin/users
- PATCH /api/admin/users/:id
- DELETE /api/admin/users/:id
- POST /api/admin/dev/reset

### c. Request I/O（要点）
- POST /api/admin/users: username 必須、role 任意（未指定 user）
- PATCH /api/admin/users/:id: username? と/または role?（少なくとも1項目）
- POST /api/admin/dev/reset: ボディなし

### d. Response I/O（要点）
- GET: AdminUser[]
- POST: { ok: true, user: AdminUser }
- PATCH: { ok: true, user: AdminUser }
- DELETE: { ok: true }
- POST /api/admin/dev/reset: { ok: true }

### e. Errors
- POST 400: username 空
- PATCH 422: 更新対象キーなし、または username 空
- PATCH 404: id 不在
- DELETE 404: id 不在
- POST /api/admin/dev/reset: handlers 上では未定義（成功時 200）

## handlers.ts 全エンドポイント（抽出）

Method / Path
- GET /api/tools
- GET /api/warehouses
- POST /api/boxes/confirm
- GET /api/my/boxes
- POST /api/my/returns/request
- GET /api/admin/returns
- POST /api/admin/returns/approve
- POST /api/reservations/confirm
- GET /api/admin/users
- POST /api/admin/users
- PATCH /api/admin/users/:id
- DELETE /api/admin/users/:id
- GET /api/admin/warehouses
- POST /api/admin/warehouses
- PATCH /api/admin/warehouses/:id
- DELETE /api/admin/warehouses/:id
- GET /api/admin/tools
- POST /api/admin/tools
- PATCH /api/admin/tools/:id
- DELETE /api/admin/tools/:id
- POST /api/admin/dev/reset

### 画面別呼び出しの対応
- /tools: GET /api/tools, GET /api/warehouses
- /loan-box: GET /api/tools, GET /api/warehouses, POST /api/boxes/confirm
- /my-loans: GET /api/my/boxes?status=open, GET /api/warehouses, POST /api/my/returns/request
- /admin/returns: GET /api/admin/returns, GET /api/warehouses, POST /api/admin/returns/approve
- /admin/tools: GET /api/admin/tools, GET /api/admin/warehouses, POST /api/admin/tools, PATCH /api/admin/tools/:id, DELETE /api/admin/tools/:id
- /admin/warehouses: GET /api/admin/warehouses, POST /api/admin/warehouses, PATCH /api/admin/warehouses/:id, DELETE /api/admin/warehouses/:id
- /admin/users: GET /api/admin/users, POST /api/admin/users, PATCH /api/admin/users/:id, DELETE /api/admin/users/:id, POST /api/admin/dev/reset
- 予約API: POST /api/reservations/confirm

未使用/未呼び出し: なし（ただし新規予約APIは画面側呼び出し未定）

