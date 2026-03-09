-- name: ListWarehouses :many
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
ORDER BY
    CASE WHEN NULLIF(BTRIM(warehouse_no), '') IS NULL THEN 1 ELSE 0 END ASC,
    CASE WHEN BTRIM(warehouse_no) ~ '^[0-9]+$' THEN 0 ELSE 1 END ASC,
    CASE WHEN BTRIM(warehouse_no) ~ '^[0-9]+$' THEN CAST(BTRIM(warehouse_no) AS NUMERIC) END ASC,
    LOWER(BTRIM(COALESCE(warehouse_no, ''))) ASC,
    LOWER(name) ASC,
    id ASC;

-- name: ListWarehousesForUpdate :many
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
ORDER BY
    CASE WHEN NULLIF(BTRIM(warehouse_no), '') IS NULL THEN 1 ELSE 0 END ASC,
    CASE WHEN BTRIM(warehouse_no) ~ '^[0-9]+$' THEN 0 ELSE 1 END ASC,
    CASE WHEN BTRIM(warehouse_no) ~ '^[0-9]+$' THEN CAST(BTRIM(warehouse_no) AS NUMERIC) END ASC,
    LOWER(BTRIM(COALESCE(warehouse_no, ''))) ASC,
    LOWER(name) ASC,
    id ASC
FOR UPDATE;

-- name: CreateWarehouse :one
INSERT INTO warehouses (
    name,
    address,
    warehouse_no,
    created_at,
    updated_at
) VALUES (
    $1,
    NULLIF($2::text, ''),
    $3,
    NOW(),
    NOW()
)
RETURNING id, name, address, warehouse_no, created_at, updated_at;

-- name: GetWarehouseByName :one
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
WHERE name = $1;

-- name: UpdateWarehouseNo :one
UPDATE warehouses
SET
    warehouse_no = NULLIF($2::text, ''),
    updated_at = NOW()
WHERE id = $1
RETURNING id, name, address, warehouse_no, created_at, updated_at;

-- name: UpdateWarehouse :one
UPDATE warehouses
SET
    name = $2,
    address = NULLIF($3::text, ''),
    warehouse_no = NULLIF($4::text, ''),
    updated_at = NOW()
WHERE id = $1
RETURNING id, name, address, warehouse_no, created_at, updated_at;
