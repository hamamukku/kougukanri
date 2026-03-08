-- name: CreateUser :one
INSERT INTO users (
    role,
    department,
    user_code,
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
    $6,
    TRUE,
    NOW(),
    NOW()
)
RETURNING id, role, department, user_code, username, email, is_active, created_at, updated_at;

-- name: GetUserByLoginID :one
SELECT id, role, department, user_code, username, email, password_hash, is_active
FROM users
WHERE is_active = TRUE
  AND (email = $1 OR username = $1)
LIMIT 1;

-- name: GetUserByID :one
SELECT id, role, department, user_code, username, email, is_active
FROM users
WHERE id = $1;

-- name: LockUserForUpdate :one
SELECT id
FROM users
WHERE id = $1
FOR UPDATE;

-- name: ListAdminEmails :many
SELECT email
FROM users
WHERE role = 'admin' AND is_active = TRUE
ORDER BY created_at;

-- name: CountUsers :one
SELECT COUNT(*)::bigint AS count
FROM users;
