-- name: ListWarehouses :many
SELECT id, name, warehouse_no, created_at, updated_at
FROM warehouses
ORDER BY name ASC;

-- name: CreateWarehouse :one
INSERT INTO warehouses (
    name,
    warehouse_no,
    created_at,
    updated_at
) VALUES (
    $1,
    NULLIF($2::text, ''),
    NOW(),
    NOW()
)
RETURNING id, name, warehouse_no, created_at, updated_at;
