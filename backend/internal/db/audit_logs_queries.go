package db

import (
	"context"
	"database/sql"

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

type CountAuditLogsParams struct {
	ActorID     uuid.NullUUID
	TargetType  string
	TargetID    uuid.NullUUID
	Action      string
	CreatedFrom sql.NullTime
	CreatedTo   sql.NullTime
}

const countAuditLogsQuery = `
SELECT COUNT(*)::bigint AS total
FROM audit_logs
WHERE
    ($1::uuid IS NULL OR actor_id = $1::uuid)
    AND ($2::text = '' OR target_type = $2::text)
    AND ($3::uuid IS NULL OR target_id = $3::uuid)
    AND ($4::text = '' OR action = $4::text)
    AND ($5::timestamptz IS NULL OR created_at >= $5::timestamptz)
    AND ($6::timestamptz IS NULL OR created_at <= $6::timestamptz)
`

func (q *Queries) CountAuditLogs(ctx context.Context, arg CountAuditLogsParams) (int64, error) {
	row := q.db.QueryRowContext(ctx, countAuditLogsQuery,
		arg.ActorID,
		arg.TargetType,
		arg.TargetID,
		arg.Action,
		arg.CreatedFrom,
		arg.CreatedTo,
	)
	var total int64
	err := row.Scan(&total)
	return total, err
}

type ListAuditLogsParams struct {
	ActorID     uuid.NullUUID
	TargetType  string
	TargetID    uuid.NullUUID
	Action      string
	CreatedFrom sql.NullTime
	CreatedTo   sql.NullTime
	Limit       int32
	Offset      int32
}

const listAuditLogsQuery = `
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
LIMIT $7 OFFSET $8
`

func (q *Queries) ListAuditLogs(ctx context.Context, arg ListAuditLogsParams) ([]AuditLog, error) {
	rows, err := q.db.QueryContext(ctx, listAuditLogsQuery,
		arg.ActorID,
		arg.TargetType,
		arg.TargetID,
		arg.Action,
		arg.CreatedFrom,
		arg.CreatedTo,
		arg.Limit,
		arg.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]AuditLog, 0)
	for rows.Next() {
		var i AuditLog
		if err := rows.Scan(
			&i.ID,
			&i.ActorID,
			&i.Action,
			&i.TargetType,
			&i.TargetID,
			&i.Payload,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
