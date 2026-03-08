DROP INDEX IF EXISTS idx_tools_retired_at;

ALTER TABLE tools
DROP COLUMN IF EXISTS retired_at;
