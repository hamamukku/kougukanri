-- name: HasOverlappingReservation :one
SELECT EXISTS (
    SELECT 1
    FROM reservations r
    WHERE r.tool_id = $1
      AND r.status = 'open'
      AND daterange(r.start_date, r.due_date, '[]') && daterange($2::date, $3::date, '[]')
) AS exists;

-- name: CreateReservation :one
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
RETURNING id, tool_id, owner_username, start_date, due_date, status, created_at;
