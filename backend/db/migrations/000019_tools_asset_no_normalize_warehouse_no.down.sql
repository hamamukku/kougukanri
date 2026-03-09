DO $$
DECLARE
    invalid_asset_nos TEXT;
    duplicate_active_asset_nos TEXT;
BEGIN
    SELECT string_agg(asset_no, ', ' ORDER BY asset_no)
    INTO invalid_asset_nos
    FROM tools
    WHERE asset_no !~ '^.+-[0-9]+$';

    IF invalid_asset_nos IS NOT NULL THEN
        RAISE EXCEPTION 'tool asset_no must end with -<digits> before rollback: %', invalid_asset_nos;
    END IF;

    WITH projected AS (
        SELECT
            t.id,
            ((BTRIM(w.warehouse_no))::numeric)::text || '-' || substring(t.asset_no FROM '([0-9]+)$') AS next_asset_no
        FROM tools t
        JOIN warehouses w ON w.id = t.warehouse_id
        WHERE t.retired_at IS NULL
    ),
    duplicate_targets AS (
        SELECT next_asset_no
        FROM projected
        GROUP BY next_asset_no
        HAVING COUNT(*) > 1
    )
    SELECT string_agg(next_asset_no, ', ' ORDER BY next_asset_no)
    INTO duplicate_active_asset_nos
    FROM duplicate_targets;

    IF duplicate_active_asset_nos IS NOT NULL THEN
        RAISE EXCEPTION 'duplicate active asset_no would be generated during rollback: %', duplicate_active_asset_nos;
    END IF;
END
$$;

CREATE TEMP TABLE tmp_tool_asset_no_000019_down
ON COMMIT DROP AS
SELECT
    t.id,
    ((BTRIM(w.warehouse_no))::numeric)::text || '-' || substring(t.asset_no FROM '([0-9]+)$') AS next_asset_no
FROM tools t
JOIN warehouses w ON w.id = t.warehouse_id;

UPDATE tools
SET
    asset_no = '__tmp_asset_no_000019_down__' || id::text,
    updated_at = NOW();

UPDATE tools AS t
SET
    asset_no = rewritten.next_asset_no,
    updated_at = NOW()
FROM tmp_tool_asset_no_000019_down AS rewritten
WHERE rewritten.id = t.id;
