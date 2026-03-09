DO $$
DECLARE
    invalid_warehouse_nos TEXT;
BEGIN
    UPDATE warehouses
    SET warehouse_no = NULL
    WHERE warehouse_no IS NOT NULL
      AND BTRIM(warehouse_no) = '';

    SELECT string_agg(name || ':' || BTRIM(warehouse_no), ', ' ORDER BY name)
    INTO invalid_warehouse_nos
    FROM warehouses
    WHERE NULLIF(BTRIM(warehouse_no), '') IS NOT NULL
      AND BTRIM(warehouse_no) !~ '^[0-9]+$';

    IF invalid_warehouse_nos IS NOT NULL THEN
        RAISE EXCEPTION 'warehouse_no must contain only digits before normalization: %', invalid_warehouse_nos;
    END IF;
END
$$;

DROP INDEX IF EXISTS warehouses_warehouse_no_key;

CREATE TEMP TABLE tmp_warehouse_no_targets_000018
ON COMMIT DROP AS
WITH normalized AS (
    SELECT
        id,
        created_at,
        BTRIM(warehouse_no) AS current_warehouse_no,
        LPAD((BTRIM(warehouse_no)::numeric)::text, 5, '0') AS normalized_warehouse_no,
        CASE
            WHEN BTRIM(warehouse_no) = LPAD((BTRIM(warehouse_no)::numeric)::text, 5, '0') THEN 0
            ELSE 1
        END AS normalization_priority
    FROM warehouses
    WHERE NULLIF(BTRIM(warehouse_no), '') IS NOT NULL
),
ranked AS (
    SELECT
        id,
        normalized_warehouse_no,
        ROW_NUMBER() OVER (
            PARTITION BY normalized_warehouse_no
            ORDER BY normalization_priority ASC, created_at ASC, id ASC
        ) AS normalized_rank
    FROM normalized
),
extra_targets AS (
    SELECT
        normalized.id,
        ROW_NUMBER() OVER (
            ORDER BY normalized.normalized_warehouse_no ASC, normalized.created_at ASC, normalized.id ASC
        ) AS extra_index
    FROM normalized
    JOIN ranked ON ranked.id = normalized.id
    WHERE ranked.normalized_rank > 1
),
max_value AS (
    SELECT COALESCE(MAX((normalized_warehouse_no)::numeric), 0) AS max_no
    FROM normalized
)
SELECT
    normalized.id,
    CASE
        WHEN ranked.normalized_rank = 1 THEN normalized.normalized_warehouse_no
        ELSE LPAD(((max_value.max_no + extra_targets.extra_index)::text), 5, '0')
    END AS next_warehouse_no
FROM normalized
JOIN ranked ON ranked.id = normalized.id
LEFT JOIN extra_targets ON extra_targets.id = normalized.id
CROSS JOIN max_value;

UPDATE warehouses
SET
    warehouse_no = targets.next_warehouse_no,
    updated_at = NOW()
FROM tmp_warehouse_no_targets_000018 AS targets
WHERE targets.id = warehouses.id;

CREATE UNIQUE INDEX warehouses_warehouse_no_key
ON warehouses (warehouse_no)
WHERE NULLIF(BTRIM(warehouse_no), '') IS NOT NULL;
