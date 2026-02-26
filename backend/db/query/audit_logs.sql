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
