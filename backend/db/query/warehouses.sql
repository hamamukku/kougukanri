-- name: ListWarehouses :many
SELECT id, name, created_at, updated_at
FROM warehouses
ORDER BY name ASC;

-- name: CreateWarehouse :one
INSERT INTO warehouses (
    name,
    created_at,
    updated_at
) VALUES (
    $1,
    NOW(),
    NOW()
)
RETURNING id, name, created_at, updated_at;
