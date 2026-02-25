package db

import "context"

const listWarehousesQuery = `
SELECT id, name, created_at, updated_at
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
		if err := rows.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const createWarehouseQuery = `
INSERT INTO warehouses (
    name,
    created_at,
    updated_at
) VALUES (
    $1,
    NOW(),
    NOW()
)
RETURNING id, name, created_at, updated_at
`

func (q *Queries) CreateWarehouse(ctx context.Context, name string) (Warehouse, error) {
	row := q.db.QueryRowContext(ctx, createWarehouseQuery, name)
	var i Warehouse
	err := row.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}
