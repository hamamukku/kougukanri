package db

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const listBorrowerOpenBoxNosQuery = `
SELECT DISTINCT lb.box_no
FROM loan_boxes lb
JOIN loan_items li ON li.box_id = lb.id
WHERE lb.borrower_id = $1
  AND li.return_approved_at IS NULL
ORDER BY lb.box_no ASC
`

func (q *Queries) ListBorrowerOpenBoxNos(ctx context.Context, borrowerID uuid.UUID) ([]int32, error) {
	rows, err := q.db.QueryContext(ctx, listBorrowerOpenBoxNosQuery, borrowerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]int32, 0)
	for rows.Next() {
		var boxNo int32
		if err := rows.Scan(&boxNo); err != nil {
			return nil, err
		}
		items = append(items, boxNo)
	}
	return items, rows.Err()
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
