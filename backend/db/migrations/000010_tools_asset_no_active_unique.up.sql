ALTER TABLE tools
DROP CONSTRAINT IF EXISTS tools_asset_no_key;

DROP INDEX IF EXISTS tools_asset_no_key;

CREATE UNIQUE INDEX tools_asset_no_key
ON tools(asset_no)
WHERE retired_at IS NULL;
