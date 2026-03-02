CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    department TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE tool_asset_no_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_no TEXT NOT NULL UNIQUE DEFAULT ('T-' || LPAD(nextval('tool_asset_no_seq')::text, 6, '0')),
    tag_id TEXT NULL,
    name TEXT NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    base_status TEXT NOT NULL CHECK (base_status IN ('AVAILABLE', 'BROKEN', 'REPAIR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loan_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id UUID NOT NULL REFERENCES users(id),
    box_no INT NOT NULL,
    display_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (borrower_id, box_no),
    CHECK (due_date >= start_date)
);

CREATE TABLE loan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    box_id UUID NOT NULL REFERENCES loan_boxes(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id),
    borrower_id UUID NOT NULL REFERENCES users(id),
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_requested_at TIMESTAMPTZ NULL,
    return_requested_by UUID NULL REFERENCES users(id),
    return_approved_at TIMESTAMPTZ NULL,
    return_approved_by UUID NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (due_date >= start_date),
    CONSTRAINT loan_items_tool_period_excl
        EXCLUDE USING gist (
            tool_id WITH =,
            daterange(start_date, due_date, '[]') WITH &&
        )
        WHERE (return_approved_at IS NULL)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NULL,
    payload JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL REFERENCES users(id),
    approved_user_id UUID NULL REFERENCES users(id)
);

CREATE INDEX idx_tools_warehouse_id ON tools(warehouse_id);
CREATE UNIQUE INDEX idx_tools_tag_id_unique ON tools(tag_id) WHERE tag_id IS NOT NULL;
CREATE INDEX idx_loan_items_tool_id ON loan_items(tool_id);
CREATE INDEX idx_loan_items_borrower_id ON loan_items(borrower_id);
CREATE INDEX idx_loan_items_box_id ON loan_items(box_id);
CREATE INDEX idx_loan_items_return_approved_at ON loan_items(return_approved_at);
CREATE INDEX idx_loan_items_return_requested_at ON loan_items(return_requested_at);
CREATE INDEX idx_loan_items_tool_period ON loan_items(tool_id, start_date, due_date);
CREATE UNIQUE INDEX idx_user_signup_requests_username_pending ON user_signup_requests(username) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_user_signup_requests_email_pending ON user_signup_requests(email) WHERE status = 'pending';
CREATE INDEX idx_user_signup_requests_status_requested_at ON user_signup_requests(status, requested_at DESC);
