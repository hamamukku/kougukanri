package db

import (
	"context"

	"github.com/google/uuid"
)

const createAuditLogQuery = `
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
RETURNING id
`

type CreateAuditLogParams struct {
	ActorID    uuid.NullUUID
	Action     string
	TargetType string
	TargetID   uuid.NullUUID
	Payload    []byte
}

func (q *Queries) CreateAuditLog(ctx context.Context, arg CreateAuditLogParams) (uuid.UUID, error) {
	row := q.db.QueryRowContext(ctx, createAuditLogQuery,
		arg.ActorID,
		arg.Action,
		arg.TargetType,
		arg.TargetID,
		arg.Payload,
	)
	var id uuid.UUID
	err := row.Scan(&id)
	return id, err
}
