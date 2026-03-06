CREATE TABLE IF NOT EXISTS agency_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_by INTEGER NOT NULL,
  agency_name TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  source_file_name TEXT NOT NULL,
  stored_file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  ocr_status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS agency_bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  raw_medicine_name TEXT,
  normalized_medicine_name TEXT,
  batch_no TEXT,
  expiry_date TEXT,
  quantity INTEGER,
  purchase_price REAL,
  mrp REAL,
  match_medicine_id INTEGER,
  resolution_status TEXT NOT NULL DEFAULT 'needs_review',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES agency_bills(id),
  FOREIGN KEY (match_medicine_id) REFERENCES medicines(id)
);

CREATE TABLE IF NOT EXISTS medicine_stock_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  delta_quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_agency_bills_status ON agency_bills(status);
CREATE INDEX IF NOT EXISTS idx_agency_bill_items_bill ON agency_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_medicine ON medicine_stock_ledger(medicine_id);
