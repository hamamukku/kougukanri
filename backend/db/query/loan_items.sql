-- name: HasOverlappingLoanItem :one
SELECT EXISTS (
    SELECT 1
    FROM loan_items li
    WHERE li.tool_id = $1
      AND li.return_approved_at IS NULL
      AND daterange(li.start_date, li.due_date, '[]') && daterange($2::date, $3::date, '[]')
) AS exists;

-- name: HasFutureReservationByOther :one
SELECT EXISTS (
    SELECT 1
    FROM loan_items li
    WHERE li.tool_id = $1
      AND li.return_approved_at IS NULL
      AND li.start_date > $2::date
      AND li.borrower_id <> $3
) AS exists;

-- name: CreateLoanItem :one
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
RETURNING id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at;

-- name: ListMyOpenLoanItems :many
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
ORDER BY li.start_date ASC, li.created_at ASC;

-- name: GetLoanItemForUpdate :one
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE id = $1
FOR UPDATE;

-- name: MarkLoanItemReturnRequested :exec
UPDATE loan_items
SET return_requested_at = $2,
    return_requested_by = $3,
    updated_at = NOW()
WHERE id = $1;

-- name: ListReturnRequestRows :many
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
ORDER BY lb.created_at ASC, li.created_at ASC;

-- name: ListPendingRequestedItemsInBoxForUpdate :many
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE box_id = $1
  AND return_requested_at IS NOT NULL
  AND return_approved_at IS NULL
FOR UPDATE;

-- name: GetLoanItemInBoxForUpdate :one
SELECT id, box_id, tool_id, borrower_id, start_date, due_date, return_requested_at, return_requested_by, return_approved_at, return_approved_by, created_at, updated_at
FROM loan_items
WHERE id = $1
FOR UPDATE;

-- name: ApproveLoanItemReturn :exec
UPDATE loan_items
SET return_approved_at = $2,
    return_approved_by = $3,
    updated_at = NOW()
WHERE id = $1;

-- name: ListOverdueLoanItems :many
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
ORDER BY u.username ASC, li.due_date ASC;
