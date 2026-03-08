ALTER TABLE tools
ADD COLUMN retired_at TIMESTAMPTZ NULL;

CREATE INDEX idx_tools_retired_at ON tools(retired_at);
