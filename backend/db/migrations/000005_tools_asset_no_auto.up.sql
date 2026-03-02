CREATE SEQUENCE IF NOT EXISTS tool_asset_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

DO $$
DECLARE
    max_asset_no bigint;
BEGIN
    SELECT MAX((substring(asset_no FROM 3))::bigint)
    INTO max_asset_no
    FROM tools
    WHERE asset_no ~ '^T-[0-9]{6}$';

    IF max_asset_no IS NULL THEN
        PERFORM setval('tool_asset_no_seq', 1, false);
    ELSE
        PERFORM setval('tool_asset_no_seq', max_asset_no, true);
    END IF;
END
$$;

ALTER TABLE tools
ALTER COLUMN asset_no SET DEFAULT ('T-' || LPAD(nextval('tool_asset_no_seq')::text, 6, '0'));
