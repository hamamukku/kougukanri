ALTER TABLE tools
ALTER COLUMN asset_no DROP DEFAULT;

DROP SEQUENCE IF EXISTS tool_asset_no_seq;

WITH ranked AS (
    SELECT
        t.id,
        w.name AS warehouse_name,
        ROW_NUMBER() OVER (
            PARTITION BY t.warehouse_id
            ORDER BY
                CASE WHEN t.retired_at IS NULL THEN 0 ELSE 1 END,
                t.asset_no ASC,
                t.created_at ASC,
                t.id ASC
        ) AS seq
    FROM tools t
    JOIN warehouses w ON w.id = t.warehouse_id
)
UPDATE tools AS t
SET
    asset_no = ranked.warehouse_name || '-' || LPAD(ranked.seq::text, 3, '0'),
    updated_at = NOW()
FROM ranked
WHERE ranked.id = t.id;
