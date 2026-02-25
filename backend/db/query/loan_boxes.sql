-- name: GetMaxBorrowerBoxNo :one
SELECT COALESCE(MAX(box_no), 0)::int AS max_box_no
FROM loan_boxes
WHERE borrower_id = $1;

-- name: CreateLoanBox :one
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
RETURNING id, borrower_id, box_no, display_name, start_date, due_date, created_at, updated_at;

-- name: GetLoanBoxByID :one
SELECT id, borrower_id, box_no, display_name, start_date, due_date, created_at, updated_at
FROM loan_boxes
WHERE id = $1;
