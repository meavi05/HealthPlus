ALTER TABLE users ADD COLUMN mobile_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number);
