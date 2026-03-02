-- name: ListDepartments :many
SELECT id, name, created_at, updated_at
FROM departments
ORDER BY name ASC;

-- name: CreateDepartment :one
INSERT INTO departments (
    name,
    created_at,
    updated_at
) VALUES (
    $1,
    NOW(),
    NOW()
)
RETURNING id, name, created_at, updated_at;

-- name: CreateDepartmentIfNotExists :one
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
RETURNING id, name, created_at, updated_at;

-- name: GetDepartmentByID :one
SELECT id, name, created_at, updated_at
FROM departments
WHERE id = $1;

-- name: GetDepartmentByName :one
SELECT id, name, created_at, updated_at
FROM departments
WHERE name = $1;

-- name: CountDepartments :one
SELECT COUNT(*)::bigint AS count
FROM departments;

-- name: CountDepartmentUsage :one
SELECT (
    (SELECT COUNT(*) FROM users WHERE is_active = TRUE AND department = $1)
    + (SELECT COUNT(*) FROM user_signup_requests WHERE status = 'pending' AND department = $1)
)::bigint AS count;

-- name: DeleteDepartmentByID :execrows
DELETE FROM departments
WHERE id = $1;
