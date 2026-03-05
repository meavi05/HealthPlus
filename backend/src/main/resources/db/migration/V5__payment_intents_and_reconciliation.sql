CREATE TABLE IF NOT EXISTS payment_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  transaction_ref TEXT,
  callback_token TEXT NOT NULL,
  gateway_reference TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intent_callback_token ON payment_intents(callback_token);

ALTER TABLE orders ADD COLUMN payment_intent_id INTEGER;
ALTER TABLE orders ADD COLUMN transaction_ref TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at DATETIME;
ALTER TABLE orders ADD COLUMN refunded_at DATETIME;
ALTER TABLE orders ADD COLUMN refund_ref TEXT;

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  checked_intents INTEGER DEFAULT 0,
  repaired_intents INTEGER DEFAULT 0,
  notes TEXT
);
