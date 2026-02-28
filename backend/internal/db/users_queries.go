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

const getUserByIDForUpdateQuery = `
SELECT id, role, department, username, email, password_hash, is_active, created_at, updated_at
FROM users
WHERE id = $1
FOR UPDATE
`

func (q *Queries) GetUserByIDForUpdate(ctx context.Context, id uuid.UUID) (User, error) {
	row := q.db.QueryRowContext(ctx, getUserByIDForUpdateQuery, id)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Role,
		&i.Department,
		&i.Username,
		&i.Email,
		&i.PasswordHash,
		&i.IsActive,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

type UpdateUserProfileParams struct {
	ID           uuid.UUID
	Department   string
	Username     string
	Email        string
	PasswordHash string
}

const updateUserProfileQuery = `
UPDATE users
SET
    department = $2,
    username = $3,
    email = $4,
    password_hash = $5,
    updated_at = NOW()
WHERE id = $1 AND is_active = TRUE
RETURNING id, role, department, username, email, is_active, created_at, updated_at
`

func (q *Queries) UpdateUserProfile(ctx context.Context, arg UpdateUserProfileParams) (UserSafe, error) {
	row := q.db.QueryRowContext(ctx, updateUserProfileQuery,
		arg.ID,
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

const listActiveUsersQuery = `
SELECT id, role, department, username, email, is_active, created_at, updated_at
FROM users
WHERE is_active = TRUE
ORDER BY created_at DESC, id DESC
`

func (q *Queries) ListActiveUsers(ctx context.Context) ([]UserSafe, error) {
	rows, err := q.db.QueryContext(ctx, listActiveUsersQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]UserSafe, 0)
	for rows.Next() {
		var i UserSafe
		if err := rows.Scan(
			&i.ID,
			&i.Role,
			&i.Department,
			&i.Username,
			&i.Email,
			&i.IsActive,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

type ListActiveUsersPageParams struct {
	Limit  int32
	Offset int32
}

const listActiveUsersPageQuery = `
SELECT id, role, department, username, email, is_active, created_at, updated_at
FROM users
WHERE is_active = TRUE
ORDER BY created_at DESC, id DESC
LIMIT $1 OFFSET $2
`

func (q *Queries) ListActiveUsersPage(ctx context.Context, arg ListActiveUsersPageParams) ([]UserSafe, error) {
	rows, err := q.db.QueryContext(ctx, listActiveUsersPageQuery, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]UserSafe, 0)
	for rows.Next() {
		var i UserSafe
		if err := rows.Scan(
			&i.ID,
			&i.Role,
			&i.Department,
			&i.Username,
			&i.Email,
			&i.IsActive,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const countActiveUsersQuery = `
SELECT COUNT(*)::bigint AS count
FROM users
WHERE is_active = TRUE
`

func (q *Queries) CountActiveUsers(ctx context.Context) (int64, error) {
	row := q.db.QueryRowContext(ctx, countActiveUsersQuery)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const countActiveAdminsQuery = `
SELECT COUNT(*)::bigint AS count
FROM users
WHERE role = 'admin' AND is_active = TRUE
`

func (q *Queries) CountActiveAdmins(ctx context.Context) (int64, error) {
	row := q.db.QueryRowContext(ctx, countActiveAdminsQuery)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const deactivateUserByIDQuery = `
UPDATE users
SET
    is_active = FALSE,
    updated_at = NOW()
WHERE id = $1 AND is_active = TRUE
`

func (q *Queries) DeactivateUserByID(ctx context.Context, id uuid.UUID) (int64, error) {
	result, err := q.db.ExecContext(ctx, deactivateUserByIDQuery, id)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
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
