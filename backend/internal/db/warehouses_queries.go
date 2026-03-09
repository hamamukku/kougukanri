package db

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

const listWarehousesQuery = `
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
ORDER BY name ASC
`

func (q *Queries) ListWarehouses(ctx context.Context) ([]Warehouse, error) {
	rows, err := q.db.QueryContext(ctx, listWarehousesQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Warehouse, 0)
	for rows.Next() {
		var i Warehouse
		if err := rows.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const createWarehouseQuery = `
INSERT INTO warehouses (
    name,
    address,
    warehouse_no,
    created_at,
    updated_at
) VALUES (
    $1,
    NULLIF($2::text, ''),
    NULLIF($3::text, ''),
    NOW(),
    NOW()
)
RETURNING id, name, address, warehouse_no, created_at, updated_at
`

func (q *Queries) CreateWarehouse(ctx context.Context, name string, address, warehouseNo sql.NullString) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, createWarehouseQuery, name, address, warehouseNo)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const getWarehouseByIDQuery = `
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
WHERE id = $1
`

func (q *Queries) GetWarehouseByID(ctx context.Context, id uuid.UUID) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, getWarehouseByIDQuery, id)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const getWarehouseByIDForUpdateQuery = `
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
WHERE id = $1
FOR UPDATE
`

func (q *Queries) GetWarehouseByIDForUpdate(ctx context.Context, id uuid.UUID) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, getWarehouseByIDForUpdateQuery, id)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const countToolsByWarehouseQuery = `
SELECT COUNT(*)::bigint AS count
FROM tools
WHERE warehouse_id = $1
`

func (q *Queries) CountToolsByWarehouse(ctx context.Context, warehouseID uuid.UUID) (int64, error) {
	row := q.db.QueryRowContext(ctx, countToolsByWarehouseQuery, warehouseID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const deleteWarehouseByIDQuery = `
DELETE FROM warehouses
WHERE id = $1
`

func (q *Queries) DeleteWarehouseByID(ctx context.Context, id uuid.UUID) (int64, error) {
	result, err := q.db.ExecContext(ctx, deleteWarehouseByIDQuery, id)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
}

const getWarehouseByNameQuery = `
SELECT id, name, address, warehouse_no, created_at, updated_at
FROM warehouses
WHERE name = $1
`

func (q *Queries) GetWarehouseByName(ctx context.Context, name string) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, getWarehouseByNameQuery, name)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

type UpdateWarehouseNoParams struct {
	ID          uuid.UUID
	WarehouseNo sql.NullString
}

const updateWarehouseNoQuery = `
UPDATE warehouses
SET
    warehouse_no = NULLIF($2::text, ''),
    updated_at = NOW()
WHERE id = $1
RETURNING id, name, address, warehouse_no, created_at, updated_at
`

func (q *Queries) UpdateWarehouseNo(ctx context.Context, arg UpdateWarehouseNoParams) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, updateWarehouseNoQuery, arg.ID, arg.WarehouseNo)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

type UpdateWarehouseParams struct {
	ID          uuid.UUID
	Name        string
	Address     sql.NullString
	WarehouseNo sql.NullString
}

const updateWarehouseQuery = `
UPDATE warehouses
SET
    name = $2,
    address = NULLIF($3::text, ''),
    warehouse_no = NULLIF($4::text, ''),
    updated_at = NOW()
WHERE id = $1
RETURNING id, name, address, warehouse_no, created_at, updated_at
`

func (q *Queries) UpdateWarehouse(ctx context.Context, arg UpdateWarehouseParams) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, updateWarehouseQuery,
		arg.ID,
		arg.Name,
		arg.Address,
		arg.WarehouseNo,
	)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.Address, &i.WarehouseNo, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}
