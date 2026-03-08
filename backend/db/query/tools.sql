-- name: CreateTool :one
INSERT INTO tools (
    asset_no,
    tag_id,
    name,
    warehouse_id,
    base_status,
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
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at;

-- name: GetToolByID :one
SELECT id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
FROM tools
WHERE id = $1;

-- name: GetToolForUpdate :one
SELECT id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
FROM tools
WHERE id = $1
FOR UPDATE;

-- name: UpdateTool :one
UPDATE tools
SET asset_no = $2,
    name = $3,
    warehouse_id = $4,
    base_status = $5,
    updated_at = NOW()
WHERE id = $1
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at;

-- name: UpdateToolTag :one
UPDATE tools
SET tag_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at;

-- name: RetireTool :one
UPDATE tools
SET retired_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at;

-- name: GetToolByTag :one
SELECT id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
FROM tools
WHERE tag_id = $1
  AND retired_at IS NULL;

-- name: CountToolsWithDisplay :one
WITH tool_state AS (
    SELECT
        t.id,
        t.asset_no,
        t.name,
        t.warehouse_id,
        w.name AS warehouse_name,
        t.base_status,
        EXISTS (
            SELECT 1
            FROM loan_items li_history
            WHERE li_history.tool_id = t.id
        ) AS has_loan_history,
        loan.start_date AS loan_start_date,
        loan.due_date AS loan_due_date,
        reserve.start_date AS reserved_start_date,
        reserve.due_date AS reserved_due_date,
        reserve.borrower_id AS reserved_by
    FROM tools t
    JOIN warehouses w ON w.id = t.warehouse_id
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date <= $1::date
        ORDER BY li.start_date DESC
        LIMIT 1
    ) AS loan ON TRUE
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date > $1::date
        ORDER BY li.start_date ASC
        LIMIT 1
    ) AS reserve ON TRUE
    WHERE
        t.retired_at IS NULL
        AND
        (NULLIF($2::text, '') IS NULL OR t.warehouse_id = NULLIF($2::text, '')::uuid)
        AND (
            $3::text = ''
            OR (
                CASE
                    WHEN $4::text = 'exact' THEN (t.name = $3::text OR t.asset_no = $3::text)
                    ELSE (t.name ILIKE '%' || $3::text || '%' OR t.asset_no ILIKE '%' || $3::text || '%')
                END
            )
        )
)
SELECT COUNT(*)::bigint AS total
FROM tool_state
WHERE
    (
        $5::text = ''
        OR (
            CASE
                WHEN base_status = 'BROKEN' THEN 'BROKEN'
                WHEN base_status = 'REPAIR' THEN 'REPAIR'
                WHEN loan_start_date IS NOT NULL THEN 'LOANED'
                WHEN reserved_start_date IS NOT NULL THEN 'RESERVED'
                ELSE 'AVAILABLE'
            END = $5::text
        )
    );

-- name: ListToolsWithDisplay :many
WITH tool_state AS (
    SELECT
        t.id,
        t.asset_no,
        t.name,
        t.warehouse_id,
        w.name AS warehouse_name,
        t.base_status,
        EXISTS (
            SELECT 1
            FROM loan_items li_history
            WHERE li_history.tool_id = t.id
        ) AS has_loan_history,
        loan.start_date AS loan_start_date,
        loan.due_date AS loan_due_date,
        reserve.start_date AS reserved_start_date,
        reserve.due_date AS reserved_due_date,
        reserve.borrower_id AS reserved_by
    FROM tools t
    JOIN warehouses w ON w.id = t.warehouse_id
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date <= $1::date
        ORDER BY li.start_date DESC
        LIMIT 1
    ) AS loan ON TRUE
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date > $1::date
        ORDER BY li.start_date ASC
        LIMIT 1
    ) AS reserve ON TRUE
    WHERE
        t.retired_at IS NULL
        AND
        (NULLIF($2::text, '') IS NULL OR t.warehouse_id = NULLIF($2::text, '')::uuid)
        AND (
            $3::text = ''
            OR (
                CASE
                    WHEN $4::text = 'exact' THEN (t.name = $3::text OR t.asset_no = $3::text)
                    ELSE (t.name ILIKE '%' || $3::text || '%' OR t.asset_no ILIKE '%' || $3::text || '%')
                END
            )
        )
)
SELECT
    id,
    asset_no,
    name,
    warehouse_id,
    warehouse_name,
    base_status,
    has_loan_history,
    CASE
        WHEN base_status = 'BROKEN' THEN 'BROKEN'
        WHEN base_status = 'REPAIR' THEN 'REPAIR'
        WHEN loan_start_date IS NOT NULL THEN 'LOANED'
        WHEN reserved_start_date IS NOT NULL THEN 'RESERVED'
        ELSE 'AVAILABLE'
    END AS display_status,
    CASE
        WHEN loan_start_date IS NOT NULL THEN loan_start_date
        ELSE reserved_start_date
    END AS display_start_date,
    CASE
        WHEN loan_due_date IS NOT NULL THEN loan_due_date
        ELSE reserved_due_date
    END AS display_due_date,
    CASE
        WHEN reserved_start_date IS NOT NULL AND reserved_by <> $5::uuid THEN TRUE
        ELSE FALSE
    END AS is_blocked_by_other_reservation,
    CASE
        WHEN reserved_start_date IS NOT NULL AND reserved_by = $5::uuid THEN TRUE
        ELSE FALSE
    END AS is_reserved_by_me
FROM tool_state
WHERE
    (
        $6::text = ''
        OR (
            CASE
                WHEN base_status = 'BROKEN' THEN 'BROKEN'
                WHEN base_status = 'REPAIR' THEN 'REPAIR'
                WHEN loan_start_date IS NOT NULL THEN 'LOANED'
                WHEN reserved_start_date IS NOT NULL THEN 'RESERVED'
                ELSE 'AVAILABLE'
            END = $6::text
        )
    )
ORDER BY
    CASE
        WHEN BOOL_AND(asset_no ~ '^[0-9]+$') OVER () THEN asset_no::numeric
        ELSE NULL
    END NULLS LAST,
    asset_no ASC
LIMIT $7 OFFSET $8;
