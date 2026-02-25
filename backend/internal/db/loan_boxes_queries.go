package db

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const getMaxBorrowerBoxNoQuery = `
SELECT COALESCE(MAX(box_no), 0)::int AS max_box_no
FROM loan_boxes
WHERE borrower_id = $1
`

func (q *Queries) GetMaxBorrowerBoxNo(ctx context.Context, borrowerID uuid.UUID) (int32, error) {
	row := q.db.QueryRowContext(ctx, getMaxBorrowerBoxNoQuery, borrowerID)
	var max int32
	err := row.Scan(&max)
	return max, err
}

type CreateLoanBoxParams struct {
	BorrowerID  uuid.UUID
	BoxNo       int32
	DisplayName string
	StartDate   time.Time
	DueDate     time.Time
}

const createLoanBoxQuery = `
INSERT INTO loan_boxes (
    borrower_id,
    box_no,
    display_name,
    start_date,
    due_date,
    created_at,
    updated_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    NOW(),
    NOW()
)
RETURNING id, borrower_id, box_no, display_name, start_date, due_date, created_at, updated_at
`

func (q *Queries) CreateLoanBox(ctx context.Context, arg CreateLoanBoxParams) (LoanBox, error) {
	row := q.db.QueryRowContext(ctx, createLoanBoxQuery,
		arg.BorrowerID,
		arg.BoxNo,
		arg.DisplayName,
		arg.StartDate,
		arg.DueDate,
	)
	var i LoanBox
	err := row.Scan(
		&i.ID,
		&i.BorrowerID,
		&i.BoxNo,
		&i.DisplayName,
		&i.StartDate,
		&i.DueDate,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const getLoanBoxByIDQuery = `
SELECT id, borrower_id, box_no, display_name, start_date, due_date, created_at, updated_at
FROM loan_boxes
WHERE id = $1
`

func (q *Queries) GetLoanBoxByID(ctx context.Context, id uuid.UUID) (LoanBox, error) {
	row := q.db.QueryRowContext(ctx, getLoanBoxByIDQuery, id)
	var i LoanBox
	err := row.Scan(
		&i.ID,
		&i.BorrowerID,
		&i.BoxNo,
		&i.DisplayName,
		&i.StartDate,
		&i.DueDate,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}
