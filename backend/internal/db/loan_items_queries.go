package db

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type HasOverlappingLoanItemParams struct {
	ToolID    uuid.UUID
	StartDate time.Time
	DueDate   time.Time
}

const hasOverlappingLoanItemQuery = `
SELECT EXISTS (
    SELECT 1
    FROM loan_items li
    WHERE li.tool_id = $1
      AND li.return_approved_at IS NULL
      AND daterange(li.start_date, li.due_date, '[]') && daterange($2::date, $3::date, '[]')
) AS exists
`

func (q *Queries) HasOverlappingLoanItem(ctx context.Context, arg HasOverlappingLoanItemParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, hasOverlappingLoanItemQuery, arg.ToolID, arg.StartDate, arg.DueDate)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

type HasFutureReservationByOtherParams struct {
	ToolID      uuid.UUID
	Today       time.Time
	BorrowerID  uuid.UUID
}

const hasFutureReservationByOtherQuery = `
SELECT EXISTS (
    SELECT 1
    FROM loan_items li
    WHERE li.tool_id = $1
      AND li.return_approved_at IS NULL
      AND li.start_date > $2::date
      AND li.borrower_id <> $3
) AS exists
`

func (q *Queries) HasFutureReservationByOther(ctx context.Context, arg HasFutureReservationByOtherParams) (bool, error) {
	row := q.db.QueryRowContext(ctx, hasFutureReservationByOtherQuery, arg.ToolID, arg.Today, arg.BorrowerID)
	var exists bool
	err := row.Scan(&exists)
	return exists, err
}

type CreateLoanItemParams struct {
	BoxID      uuid.UUID
	ToolID     uuid.UUID
	BorrowerID uuid.UUID
	StartDate  time.Time
	DueDate    time.Time
}

const createLoanItemQuery = `
INSERT INTO loan_items (
    box_id,
    tool_id,
    borrower_id,
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
RETURNING id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
`

func (q *Queries) CreateLoanItem(ctx context.Context, arg CreateLoanItemParams) (LoanItem, error) {
	row := q.db.QueryRowContext(ctx, createLoanItemQuery,
		arg.BoxID,
		arg.ToolID,
		arg.BorrowerID,
		arg.StartDate,
		arg.DueDate,
	)
	var i LoanItem
	err := row.Scan(
		&i.ID,
		&i.BoxID,
		&i.ToolID,
		&i.BorrowerID,
		&i.StartDate,
		&i.DueDate,
		&i.ReturnRequestedAt,
		&i.ReturnRequestedBy,
		&i.ReturnApprovedAt,
		&i.ReturnApprovedBy,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const listMyOpenLoanItemsQuery = `
SELECT
    li.id,
    li.box_id,
    lb.display_name AS box_display_name,
    li.tool_id,
    t.asset_no,
    t.name AS tool_name,
    li.start_date,
    li.due_date,
    li.return_requested_at,
    li.return_approved_at
FROM loan_items li
JOIN loan_boxes lb ON lb.id = li.box_id
JOIN tools t ON t.id = li.tool_id
WHERE li.borrower_id = $1
  AND li.return_approved_at IS NULL
ORDER BY li.start_date ASC, li.created_at ASC
`

func (q *Queries) ListMyOpenLoanItems(ctx context.Context, borrowerID uuid.UUID) ([]MyOpenLoanItem, error) {
	rows, err := q.db.QueryContext(ctx, listMyOpenLoanItemsQuery, borrowerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]MyOpenLoanItem, 0)
	for rows.Next() {
		var i MyOpenLoanItem
		if err := rows.Scan(
			&i.ID,
			&i.BoxID,
			&i.BoxDisplayName,
			&i.ToolID,
			&i.AssetNo,
			&i.ToolName,
			&i.StartDate,
			&i.DueDate,
			&i.ReturnRequestedAt,
			&i.ReturnApprovedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const getLoanItemForUpdateQuery = `
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE id = $1
FOR UPDATE
`

func (q *Queries) GetLoanItemForUpdate(ctx context.Context, id uuid.UUID) (LoanItem, error) {
	row := q.db.QueryRowContext(ctx, getLoanItemForUpdateQuery, id)
	var i LoanItem
	err := row.Scan(
		&i.ID,
		&i.BoxID,
		&i.ToolID,
		&i.BorrowerID,
		&i.StartDate,
		&i.DueDate,
		&i.ReturnRequestedAt,
		&i.ReturnRequestedBy,
		&i.ReturnApprovedAt,
		&i.ReturnApprovedBy,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const listBorrowerPendingReturnItemsForUpdateQuery = `
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE borrower_id = $1
  AND return_requested_at IS NULL
  AND return_approved_at IS NULL
ORDER BY created_at ASC, id ASC
FOR UPDATE
`

func (q *Queries) ListBorrowerPendingReturnItemsForUpdate(ctx context.Context, borrowerID uuid.UUID) ([]LoanItem, error) {
	rows, err := q.db.QueryContext(ctx, listBorrowerPendingReturnItemsForUpdateQuery, borrowerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]LoanItem, 0)
	for rows.Next() {
		var i LoanItem
		if err := rows.Scan(
			&i.ID,
			&i.BoxID,
			&i.ToolID,
			&i.BorrowerID,
			&i.StartDate,
			&i.DueDate,
			&i.ReturnRequestedAt,
			&i.ReturnRequestedBy,
			&i.ReturnApprovedAt,
			&i.ReturnApprovedBy,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

type MarkLoanItemReturnRequestedParams struct {
	ID              uuid.UUID
	ReturnRequestedAt time.Time
	ReturnRequestedBy uuid.UUID
}

const markLoanItemReturnRequestedQuery = `
UPDATE loan_items
SET return_requested_at = $2,
    return_requested_by = $3,
    updated_at = NOW()
WHERE id = $1
`

func (q *Queries) MarkLoanItemReturnRequested(ctx context.Context, arg MarkLoanItemReturnRequestedParams) error {
	_, err := q.db.ExecContext(ctx, markLoanItemReturnRequestedQuery, arg.ID, arg.ReturnRequestedAt, arg.ReturnRequestedBy)
	return err
}

const listReturnRequestRowsQuery = `
SELECT
    lb.id AS box_id,
    lb.display_name AS box_display_name,
    lb.start_date AS box_start_date,
    lb.due_date AS box_due_date,
    u.username AS borrower_username,
    li.id AS loan_item_id,
    li.tool_id,
    t.asset_no,
    t.name AS tool_name,
    li.start_date,
    li.due_date,
    li.return_requested_at
FROM loan_items li
JOIN loan_boxes lb ON lb.id = li.box_id
JOIN users u ON u.id = li.borrower_id
JOIN tools t ON t.id = li.tool_id
WHERE li.return_requested_at IS NOT NULL
  AND li.return_approved_at IS NULL
ORDER BY lb.created_at ASC, li.created_at ASC
`

func (q *Queries) ListReturnRequestRows(ctx context.Context) ([]ReturnRequestRow, error) {
	rows, err := q.db.QueryContext(ctx, listReturnRequestRowsQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ReturnRequestRow, 0)
	for rows.Next() {
		var i ReturnRequestRow
		if err := rows.Scan(
			&i.BoxID,
			&i.BoxDisplayName,
			&i.BoxStartDate,
			&i.BoxDueDate,
			&i.BorrowerUsername,
			&i.LoanItemID,
			&i.ToolID,
			&i.AssetNo,
			&i.ToolName,
			&i.StartDate,
			&i.DueDate,
			&i.ReturnRequestedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listPendingRequestedItemsInBoxForUpdateQuery = `
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE box_id = $1
  AND return_requested_at IS NOT NULL
  AND return_approved_at IS NULL
FOR UPDATE
`

func (q *Queries) ListPendingRequestedItemsInBoxForUpdate(ctx context.Context, boxID uuid.UUID) ([]LoanItem, error) {
	rows, err := q.db.QueryContext(ctx, listPendingRequestedItemsInBoxForUpdateQuery, boxID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]LoanItem, 0)
	for rows.Next() {
		var i LoanItem
		if err := rows.Scan(
			&i.ID,
			&i.BoxID,
			&i.ToolID,
			&i.BorrowerID,
			&i.StartDate,
			&i.DueDate,
			&i.ReturnRequestedAt,
			&i.ReturnRequestedBy,
			&i.ReturnApprovedAt,
			&i.ReturnApprovedBy,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const listAllPendingRequestedItemsForUpdateQuery = `
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE return_requested_at IS NOT NULL
  AND return_approved_at IS NULL
ORDER BY created_at ASC, id ASC
FOR UPDATE
`

func (q *Queries) ListAllPendingRequestedItemsForUpdate(ctx context.Context) ([]LoanItem, error) {
	rows, err := q.db.QueryContext(ctx, listAllPendingRequestedItemsForUpdateQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]LoanItem, 0)
	for rows.Next() {
		var i LoanItem
		if err := rows.Scan(
			&i.ID,
			&i.BoxID,
			&i.ToolID,
			&i.BorrowerID,
			&i.StartDate,
			&i.DueDate,
			&i.ReturnRequestedAt,
			&i.ReturnRequestedBy,
			&i.ReturnApprovedAt,
			&i.ReturnApprovedBy,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const getLoanItemInBoxForUpdateQuery = `
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE id = $1
FOR UPDATE
`

func (q *Queries) GetLoanItemInBoxForUpdate(ctx context.Context, id uuid.UUID) (LoanItem, error) {
	row := q.db.QueryRowContext(ctx, getLoanItemInBoxForUpdateQuery, id)
	var i LoanItem
	err := row.Scan(
		&i.ID,
		&i.BoxID,
		&i.ToolID,
		&i.BorrowerID,
		&i.StartDate,
		&i.DueDate,
		&i.ReturnRequestedAt,
		&i.ReturnRequestedBy,
		&i.ReturnApprovedAt,
		&i.ReturnApprovedBy,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

type ApproveLoanItemReturnParams struct {
	ID               uuid.UUID
	ReturnApprovedAt time.Time
	ReturnApprovedBy uuid.UUID
}

const approveLoanItemReturnQuery = `
UPDATE loan_items
SET return_approved_at = $2,
    return_approved_by = $3,
    updated_at = NOW()
WHERE id = $1
`

func (q *Queries) ApproveLoanItemReturn(ctx context.Context, arg ApproveLoanItemReturnParams) error {
	_, err := q.db.ExecContext(ctx, approveLoanItemReturnQuery, arg.ID, arg.ReturnApprovedAt, arg.ReturnApprovedBy)
	return err
}

type ListOverdueLoanItemsParams struct {
	Today time.Time
}

const listOverdueLoanItemsQuery = `
SELECT
    li.id AS loan_item_id,
    li.box_id,
    lb.display_name AS box_display_name,
    li.tool_id,
    t.asset_no,
    t.name AS tool_name,
    li.start_date,
    li.due_date,
    u.id AS borrower_id,
    u.username AS borrower_username,
    u.email AS borrower_email
FROM loan_items li
JOIN loan_boxes lb ON lb.id = li.box_id
JOIN tools t ON t.id = li.tool_id
JOIN users u ON u.id = li.borrower_id
WHERE li.return_approved_at IS NULL
  AND li.start_date <= $1::date
  AND li.due_date < $1::date
ORDER BY u.username ASC, li.due_date ASC
`

func (q *Queries) ListOverdueLoanItems(ctx context.Context, arg ListOverdueLoanItemsParams) ([]OverdueLoanItem, error) {
	rows, err := q.db.QueryContext(ctx, listOverdueLoanItemsQuery, arg.Today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]OverdueLoanItem, 0)
	for rows.Next() {
		var i OverdueLoanItem
		if err := rows.Scan(
			&i.LoanItemID,
			&i.BoxID,
			&i.BoxDisplayName,
			&i.ToolID,
			&i.AssetNo,
			&i.ToolName,
			&i.StartDate,
			&i.DueDate,
			&i.BorrowerID,
			&i.BorrowerUsername,
			&i.BorrowerEmail,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
