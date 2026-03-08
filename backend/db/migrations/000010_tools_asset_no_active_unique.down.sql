DROP INDEX IF EXISTS tools_asset_no_key;

ALTER TABLE tools
ADD CONSTRAINT tools_asset_no_key UNIQUE (asset_no);
