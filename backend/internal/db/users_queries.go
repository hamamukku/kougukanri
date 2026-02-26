package db

import (
	"context"

	"github.com/google/uuid"
)

type CreateUserParams struct {
	Role         string
	Department   string
	Username     string
	Email        string
	PasswordHash string
}

const createUserQuery = `
INSERT INTO users (
    role,
    department,
    username,
    email,
    password_hash,
    is_active,
    created_at,
    updated_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    TRUE,
    NOW(),
    NOW()
)
RETURNING id, role, department, username, email, is_active, created_at, updated_at
`

func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) (UserSafe, error) {
	row := q.db.QueryRowContext(ctx, createUserQuery,
		arg.Role,
		arg.Department,
		arg.Username,
		arg.Email,
		arg.PasswordHash,
	)
	var i UserSafe
	err := row.Scan(
		&i.ID,
		&i.Role,
		&i.Department,
		&i.Username,
		&i.Email,
		&i.IsActive,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const getUserByLoginIDQuery = `
SELECT id, role, department, username, email, password_hash, is_active
FROM users
WHERE email = $1 OR username = $1
LIMIT 1
`

func (q *Queries) GetUserByLoginID(ctx context.Context, loginID string) (User, error) {
	row := q.db.QueryRowContext(ctx, getUserByLoginIDQuery, loginID)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Role,
		&i.Department,
		&i.Username,
		&i.Email,
		&i.PasswordHash,
		&i.IsActive,
	)
	return i, err
}

const getUserByIDQuery = `
SELECT id, role, department, username, email, is_active
FROM users
WHERE id = $1
`

func (q *Queries) GetUserByID(ctx context.Context, id uuid.UUID) (UserSafe, error) {
	row := q.db.QueryRowContext(ctx, getUserByIDQuery, id)
	var i UserSafe
	err := row.Scan(
		&i.ID,
		&i.Role,
		&i.Department,
		&i.Username,
		&i.Email,
		&i.IsActive,
	)
	return i, err
}

const lockUserForUpdateQuery = `
SELECT id
FROM users
WHERE id = $1
FOR UPDATE
`

func (q *Queries) LockUserForUpdate(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	row := q.db.QueryRowContext(ctx, lockUserForUpdateQuery, id)
	var lockedID uuid.UUID
	err := row.Scan(&lockedID)
	return lockedID, err
}

const listAdminEmailsQuery = `
SELECT email
FROM users
WHERE role = 'admin' AND is_active = TRUE
ORDER BY created_at
`

func (q *Queries) ListAdminEmails(ctx context.Context) ([]string, error) {
	rows, err := q.db.QueryContext(ctx, listAdminEmailsQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			return nil, err
		}
		items = append(items, email)
	}
	return items, rows.Err()
}

const countUsersQuery = `
SELECT COUNT(*)::bigint AS count
FROM users
`

func (q *Queries) CountUsers(ctx context.Context) (int64, error) {
	row := q.db.QueryRowContext(ctx, countUsersQuery)
	var count int64
	err := row.Scan(&count)
	return count, err
}
