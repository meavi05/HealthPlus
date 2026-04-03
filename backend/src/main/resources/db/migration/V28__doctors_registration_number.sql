ALTER TABLE doctors ADD COLUMN reg_no TEXT;

CREATE INDEX IF NOT EXISTS idx_doctors_reg_no ON doctors(reg_no);
