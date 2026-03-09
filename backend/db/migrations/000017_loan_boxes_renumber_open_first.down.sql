WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY borrower_id
            ORDER BY created_at ASC, id ASC
        ) AS seq
    FROM loan_boxes
)
UPDATE loan_boxes AS lb
SET
    box_no = ranked.seq,
    display_name = 'BOX-' || LPAD(ranked.seq::text, 3, '0'),
    updated_at = NOW()
FROM ranked
WHERE ranked.id = lb.id;
