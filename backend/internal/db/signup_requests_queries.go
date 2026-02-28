package db

import (
	"context"

	"github.com/google/uuid"
)

type CreateSignupRequestParams struct {
	Username     string
	Email        string
	PasswordHash string
}

const createSignupRequestQuery = `
INSERT INTO user_signup_requests (
    username,
    email,
    password_hash,
    status,
    requested_at
) VALUES (
    $1,
    $2,
    $3,
    'pending',
    NOW()
)
RETURNING
    id,
    username,
    email,
    password_hash,
    status,
    requested_at,
    reviewed_at,
    reviewed_by,
    approved_user_id
`

func (q *Queries) CreateSignupRequest(ctx context.Context, arg CreateSignupRequestParams) (SignupRequest, error) {
	row := q.db.QueryRowContext(ctx, createSignupRequestQuery,
		arg.Username,
		arg.Email,
		arg.PasswordHash,
	)
	var i SignupRequest
	err := row.Scan(
		&i.ID,
		&i.Username,
		&i.Email,
		&i.PasswordHash,
		&i.Status,
		&i.RequestedAt,
		&i.ReviewedAt,
		&i.ReviewedBy,
		&i.ApprovedUserID,
	)
	return i, err
}

const listPendingSignupRequestsQuery = `
SELECT
    id,
    username,
    email,
    password_hash,
    status,
    requested_at,
    reviewed_at,
    reviewed_by,
    approved_user_id
FROM user_signup_requests
WHERE status = 'pending'
ORDER BY requested_at DESC, id DESC
`

func (q *Queries) ListPendingSignupRequests(ctx context.Context) ([]SignupRequest, error) {
	rows, err := q.db.QueryContext(ctx, listPendingSignupRequestsQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SignupRequest, 0)
	for rows.Next() {
		var i SignupRequest
		if err := rows.Scan(
			&i.ID,
			&i.Username,
			&i.Email,
			&i.PasswordHash,
			&i.Status,
			&i.RequestedAt,
			&i.ReviewedAt,
			&i.ReviewedBy,
			&i.ApprovedUserID,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const getPendingSignupRequestForUpdateQuery = `
SELECT
    id,
    username,
    email,
    password_hash,
    status,
    requested_at,
    reviewed_at,
    reviewed_by,
    approved_user_id
FROM user_signup_requests
WHERE id = $1 AND status = 'pending'
FOR UPDATE
`

func (q *Queries) GetPendingSignupRequestForUpdate(ctx context.Context, id uuid.UUID) (SignupRequest, error) {
	row := q.db.QueryRowContext(ctx, getPendingSignupRequestForUpdateQuery, id)
	var i SignupRequest
	err := row.Scan(
		&i.ID,
		&i.Username,
		&i.Email,
		&i.PasswordHash,
		&i.Status,
		&i.RequestedAt,
		&i.ReviewedAt,
		&i.ReviewedBy,
		&i.ApprovedUserID,
	)
	return i, err
}

type MarkSignupRequestApprovedParams struct {
	ID             uuid.UUID
	ReviewedBy     uuid.UUID
	ApprovedUserID uuid.UUID
}

const markSignupRequestApprovedQuery = `
UPDATE user_signup_requests
SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = $2,
    approved_user_id = $3
WHERE id = $1 AND status = 'pending'
`

func (q *Queries) MarkSignupRequestApproved(ctx context.Context, arg MarkSignupRequestApprovedParams) error {
	_, err := q.db.ExecContext(ctx, markSignupRequestApprovedQuery,
		arg.ID,
		arg.ReviewedBy,
		arg.ApprovedUserID,
	)
	return err
}
