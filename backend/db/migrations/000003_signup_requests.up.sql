CREATE TABLE user_signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL REFERENCES users(id),
    approved_user_id UUID NULL REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_user_signup_requests_username_pending
    ON user_signup_requests (username)
    WHERE status = 'pending';

CREATE UNIQUE INDEX idx_user_signup_requests_email_pending
    ON user_signup_requests (email)
    WHERE status = 'pending';

CREATE INDEX idx_user_signup_requests_status_requested_at
    ON user_signup_requests (status, requested_at DESC);
