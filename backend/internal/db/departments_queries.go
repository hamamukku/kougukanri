package db

import (
	"context"

	"github.com/google/uuid"
)

const listDepartmentsQuery = `
SELECT id, name, created_at, updated_at
FROM departments
ORDER BY name ASC
`

func (q *Queries) ListDepartments(ctx context.Context) ([]Department, error) {
	rows, err := q.db.QueryContext(ctx, listDepartmentsQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Department, 0)
	for rows.Next() {
		var i Department
		if err := rows.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const createDepartmentQuery = `
INSERT INTO departments (
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

func (q *Queries) CreateDepartment(ctx context.Context, name string) (Department, error) {
	row := q.db.QueryRowContext(ctx, createDepartmentQuery, name)
	var i Department
	err := row.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const createDepartmentIfNotExistsQuery = `
INSERT INTO departments (
    name,
    created_at,
    updated_at
) VALUES (
    $1,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE
SET name = EXCLUDED.name
RETURNING id, name, created_at, updated_at
`

func (q *Queries) CreateDepartmentIfNotExists(ctx context.Context, name string) (Department, error) {
	row := q.db.QueryRowContext(ctx, createDepartmentIfNotExistsQuery, name)
	var i Department
	err := row.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const getDepartmentByIDQuery = `
SELECT id, name, created_at, updated_at
FROM departments
WHERE id = $1
`

func (q *Queries) GetDepartmentByID(ctx context.Context, id uuid.UUID) (Department, error) {
	row := q.db.QueryRowContext(ctx, getDepartmentByIDQuery, id)
	var i Department
	err := row.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const getDepartmentByNameQuery = `
SELECT id, name, created_at, updated_at
FROM departments
WHERE name = $1
`

func (q *Queries) GetDepartmentByName(ctx context.Context, name string) (Department, error) {
	row := q.db.QueryRowContext(ctx, getDepartmentByNameQuery, name)
	var i Department
	err := row.Scan(&i.ID, &i.Name, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

const countDepartmentsQuery = `
SELECT COUNT(*)::bigint AS count
FROM departments
`

func (q *Queries) CountDepartments(ctx context.Context) (int64, error) {
	row := q.db.QueryRowContext(ctx, countDepartmentsQuery)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const countDepartmentUsageQuery = `
SELECT (
    (SELECT COUNT(*) FROM users WHERE is_active = TRUE AND department = $1)
    + (SELECT COUNT(*) FROM user_signup_requests WHERE status = 'pending' AND department = $1)
)::bigint AS count
`

func (q *Queries) CountDepartmentUsage(ctx context.Context, name string) (int64, error) {
	row := q.db.QueryRowContext(ctx, countDepartmentUsageQuery, name)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const deleteDepartmentByIDQuery = `
DELETE FROM departments
WHERE id = $1
`

func (q *Queries) DeleteDepartmentByID(ctx context.Context, id uuid.UUID) (int64, error) {
	result, err := q.db.ExecContext(ctx, deleteDepartmentByIDQuery, id)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
}
