package db

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type HasOverlappingReservationParams struct {
	ToolID    uuid.UUID
	StartDate time.Time
	DueDate   time.Time
}

const hasOverlappingReservationQuery = `
SELECT EXISTS (
    SELECT 1
    FROM reservations r
    WHERE r.tool_id = $1
      AND r.status = 'open'
      AND daterange(r.start_date, r.due_date, '[]') && daterange($2::date, $3::date, '[]')
) AS exists
`

func (q *Queries) HasOverlappingReservation(ctx context.Context, arg HasOverlappingReservationParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, hasOverlappingReservationQuery, arg.ToolID, arg.StartDate, arg.DueDate)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

type CreateReservationParams struct {
	ToolID        uuid.UUID
	OwnerUsername string
	StartDate     time.Time
	DueDate       time.Time
	Status        string
}

const createReservationQuery = `
INSERT INTO reservations (
    tool_id,
    owner_username,
    start_date,
    due_date,
    status
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING id, tool_id, owner_username, start_date, due_date, status, created_at
`

func (q *Queries) CreateReservation(ctx context.Context, arg CreateReservationParams) (Reservation, error) {
	row := q.db.QueryRowContext(ctx, createReservationQuery,
		arg.ToolID,
		arg.OwnerUsername,
		arg.StartDate,
		arg.DueDate,
		arg.Status,
	)
	var i Reservation
	err := row.Scan(
		&i.ID,
		&i.ToolID,
		&i.OwnerUsername,
		&i.StartDate,
		&i.DueDate,
		&i.Status,
		&i.CreatedAt,
	)
	return i, err
}
