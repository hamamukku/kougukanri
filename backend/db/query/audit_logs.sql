-- name: CreateAuditLog :one
INSERT INTO audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    payload
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING id;

-- name: CountAuditLogs :one
SELECT COUNT(*)::bigint AS total
FROM audit_logs
WHERE
    ($1::uuid IS NULL OR actor_id = $1::uuid)
    AND ($2::text = '' OR target_type = $2::text)
    AND ($3::uuid IS NULL OR target_id = $3::uuid)
    AND ($4::text = '' OR action = $4::text)
    AND ($5::timestamptz IS NULL OR created_at >= $5::timestamptz)
    AND ($6::timestamptz IS NULL OR created_at <= $6::timestamptz);

-- name: ListAuditLogs :many
SELECT
    id,
    actor_id,
    action,
    target_type,
    target_id,
    payload,
    created_at
FROM audit_logs
WHERE
    ($1::uuid IS NULL OR actor_id = $1::uuid)
    AND ($2::text = '' OR target_type = $2::text)
    AND ($3::uuid IS NULL OR target_id = $3::uuid)
    AND ($4::text = '' OR action = $4::text)
    AND ($5::timestamptz IS NULL OR created_at >= $5::timestamptz)
    AND ($6::timestamptz IS NULL OR created_at <= $6::timestamptz)
ORDER BY created_at DESC, id DESC
LIMIT $7 OFFSET $8;
