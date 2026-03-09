WITH box_state AS (
    SELECT
        lb.id,
        lb.borrower_id,
        lb.created_at,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM loan_items li
                WHERE li.box_id = lb.id
                  AND li.return_approved_at IS NULL
            ) THEN 0
            ELSE 1
        END AS sort_group
    FROM loan_boxes lb
),
ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY borrower_id
            ORDER BY sort_group ASC, created_at ASC, id ASC
        ) AS seq
    FROM box_state
)
UPDATE loan_boxes AS lb
SET
    box_no = ranked.seq,
    display_name = 'BOX-' || LPAD(ranked.seq::text, 3, '0'),
    updated_at = NOW()
FROM ranked
WHERE ranked.id = lb.id;
