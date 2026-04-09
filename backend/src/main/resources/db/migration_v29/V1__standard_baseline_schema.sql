-- V29 standard baseline schema.
-- Purpose:
-- 1) Fresh DB bootstrapping from a single file.
-- 2) Backward compatibility with existing application code paths.
-- 3) New stock-ledger/UOM architecture included (DDL + views only, no DML).

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT,
  facebook_id TEXT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  profile_picture TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  role TEXT NOT NULL DEFAULT 'ROLE_USER',
  mobile_number TEXT
);

CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  stock INTEGER NOT NULL,
  category TEXT,
  brand TEXT,
  mrp REAL,
  discount_percent INTEGER DEFAULT 0,
  requires_prescription INTEGER DEFAULT 0,
  rating REAL DEFAULT 4.0,
  image_url TEXT,
  delivery_eta TEXT DEFAULT 'Today',
  admin_updated_by_user_id INTEGER,
  admin_updated_at DATETIME,
  medicine_type TEXT,
  medicine_uses TEXT,
  medicine_doses TEXT
);

CREATE TABLE IF NOT EXISTS user_delivery_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  landmark TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  total_price REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_intent_id INTEGER,
  transaction_ref TEXT,
  cancelled_at DATETIME,
  refunded_at DATETIME,
  refund_ref TEXT,
  delivery_address_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  medicine_id INTEGER,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  upi_vpa TEXT NOT NULL,
  is_verified INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

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

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  checked_intents INTEGER DEFAULT 0,
  repaired_intents INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS prescription_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL,
  original_file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  file_size_bytes INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
);

CREATE TABLE IF NOT EXISTS medicine_routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  last_taken_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gstin TEXT,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  dl_no TEXT
);

CREATE TABLE IF NOT EXISTS agency_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  invoice_no TEXT,
  bill_number TEXT,
  invoice_date TEXT,
  bill_total REAL,
  file_name TEXT,
  raw_metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES inventory_agencies(id)
);

CREATE TABLE IF NOT EXISTS ocr_receipt_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_hash TEXT NOT NULL UNIQUE,
  file_name TEXT,
  content_type TEXT,
  extracted_json TEXT NOT NULL,
  extraction_source TEXT NOT NULL DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicine_profile_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
  product_name TEXT,
  manufacturer TEXT,
  pack TEXT,
  medicine_category TEXT,
  medicine_type TEXT,
  medicine_description TEXT,
  medicine_uses TEXT,
  medicine_doses TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicine_inventory_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT,
  brand TEXT,
  hsn TEXT,
  manufacturer TEXT,
  pack TEXT,
  qty_fr TEXT,
  batch TEXT,
  expiry TEXT,
  mrp REAL,
  rate REAL,
  gst REAL DEFAULT 0,
  dis1 REAL DEFAULT 0,
  dis2 REAL DEFAULT 0,
  amount REAL,
  deal TEXT,
  effective_cost_price REAL,
  quantity_added INTEGER NOT NULL DEFAULT 0,
  bonus TEXT DEFAULT '',
  source TEXT DEFAULT 'ocr',
  agency_bill_id INTEGER REFERENCES agency_bills(id),
  medicine_category TEXT,
  medicine_type TEXT,
  medicine_description TEXT,
  medicine_uses TEXT,
  medicine_doses TEXT,
  admin_updated_by_user_id INTEGER,
  admin_updated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  bonus_qty INTEGER NOT NULL DEFAULT 0,
  sold_qty INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  gender TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reg_no TEXT
);

CREATE TABLE IF NOT EXISTS sales_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT,
  sale_date TEXT,
  patient_id INTEGER,
  doctor_id INTEGER,
  notes TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  inventory_detail_id INTEGER,
  medicine_name TEXT NOT NULL,
  batch TEXT,
  expiry TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  gst_percent REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (inventory_detail_id) REFERENCES medicine_inventory_details(id)
);

-- V29 standard inventory architecture.
CREATE TABLE IF NOT EXISTS medicine_uom (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  uom_code TEXT NOT NULL,
  uom_name TEXT NOT NULL,
  factor_to_base INTEGER NOT NULL,
  is_base INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CHECK (factor_to_base > 0),
  CHECK (is_base IN (0, 1)),
  CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  inventory_detail_id INTEGER UNIQUE,
  agency_bill_id INTEGER,
  batch TEXT,
  expiry TEXT,
  pack TEXT,
  pack_size INTEGER NOT NULL DEFAULT 1,
  received_qty_base INTEGER NOT NULL DEFAULT 0,
  bonus_qty_base INTEGER NOT NULL DEFAULT 0,
  sold_qty_base INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'legacy-backfill',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (inventory_detail_id) REFERENCES medicine_inventory_details(id),
  FOREIGN KEY (agency_bill_id) REFERENCES agency_bills(id),
  CHECK (pack_size > 0),
  CHECK (received_qty_base >= 0),
  CHECK (bonus_qty_base >= 0),
  CHECK (sold_qty_base >= 0)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  lot_id INTEGER,
  agency_bill_id INTEGER,
  inventory_detail_id INTEGER,
  sales_entry_id INTEGER,
  sales_item_id INTEGER,
  movement_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  qty_base INTEGER NOT NULL,
  qty_abs_base INTEGER NOT NULL,
  uom_code TEXT NOT NULL DEFAULT 'TAB',
  factor_to_base INTEGER NOT NULL DEFAULT 1,
  unit_price REAL,
  source TEXT NOT NULL DEFAULT 'system',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (lot_id) REFERENCES inventory_lots(id),
  FOREIGN KEY (agency_bill_id) REFERENCES agency_bills(id),
  FOREIGN KEY (inventory_detail_id) REFERENCES medicine_inventory_details(id),
  FOREIGN KEY (sales_entry_id) REFERENCES sales_entries(id),
  FOREIGN KEY (sales_item_id) REFERENCES sales_items(id),
  CHECK (direction IN ('IN', 'OUT')),
  CHECK (qty_abs_base >= 0),
  CHECK (factor_to_base > 0),
  CHECK (
    (direction = 'IN' AND qty_base >= 0)
    OR (direction = 'OUT' AND qty_base <= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_medicines_admin_updated_by_user_id ON medicines(admin_updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_user_delivery_addresses_user_id ON user_delivery_addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_active
ON user_payment_methods(user_id, provider)
WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intent_callback_token ON payment_intents(callback_token);
CREATE INDEX IF NOT EXISTS idx_inventory_agencies_name ON inventory_agencies(name);
CREATE INDEX IF NOT EXISTS idx_agency_bills_agency_id ON agency_bills(agency_id);
CREATE INDEX IF NOT EXISTS idx_ocr_receipt_cache_last_used_at ON ocr_receipt_cache(last_used_at);
CREATE INDEX IF NOT EXISTS idx_medicine_profile_cache_name_mfr ON medicine_profile_cache(product_name, manufacturer);
CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_medicine_id ON medicine_inventory_details(medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_agency_bill_id ON medicine_inventory_details(agency_bill_id);
CREATE INDEX IF NOT EXISTS idx_mid_admin_updated_by_user_id ON medicine_inventory_details(admin_updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_name_brand ON medicine_inventory_details(medicine_name, brand);
CREATE INDEX IF NOT EXISTS idx_sales_entries_invoice_no ON sales_entries(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_entries_sale_date ON sales_entries(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_entries_patient_id ON sales_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_sales_entries_doctor_id ON sales_entries(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_medicine_id ON sales_items(medicine_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_inventory_detail_id ON sales_items(inventory_detail_id);
CREATE INDEX IF NOT EXISTS idx_patients_name_phone ON patients(name, phone);
CREATE INDEX IF NOT EXISTS idx_doctors_name_phone ON doctors(name, phone);
CREATE INDEX IF NOT EXISTS idx_doctors_reg_no ON doctors(reg_no);

CREATE UNIQUE INDEX IF NOT EXISTS uq_medicine_uom_medicine_code
ON medicine_uom(medicine_id, uom_code);
CREATE INDEX IF NOT EXISTS idx_medicine_uom_medicine_id
ON medicine_uom(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_medicine_id
ON inventory_lots(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_agency_bill_id
ON inventory_lots(agency_bill_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_batch_expiry
ON inventory_lots(batch, expiry);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_medicine_id
ON stock_ledger(medicine_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_lot_id
ON stock_ledger(lot_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_inventory_detail_id
ON stock_ledger(inventory_detail_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_sales_item_id
ON stock_ledger(sales_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_created_at
ON stock_ledger(created_at);

CREATE VIEW IF NOT EXISTS v_stock_balance_medicine AS
SELECT
  m.id AS medicine_id,
  COALESCE(SUM(sl.qty_base), 0) AS available_qty_base,
  COALESCE(SUM(CASE WHEN sl.direction = 'IN' THEN sl.qty_abs_base ELSE 0 END), 0) AS total_in_qty_base,
  COALESCE(SUM(CASE WHEN sl.direction = 'OUT' THEN sl.qty_abs_base ELSE 0 END), 0) AS total_out_qty_base
FROM medicines m
LEFT JOIN stock_ledger sl
  ON sl.medicine_id = m.id
GROUP BY m.id;

CREATE VIEW IF NOT EXISTS v_stock_balance_lot AS
SELECT
  il.id AS lot_id,
  il.medicine_id,
  il.batch,
  il.expiry,
  il.pack_size,
  COALESCE(SUM(sl.qty_base), 0) AS available_qty_base,
  COALESCE(SUM(CASE WHEN sl.direction = 'IN' THEN sl.qty_abs_base ELSE 0 END), 0) AS total_in_qty_base,
  COALESCE(SUM(CASE WHEN sl.direction = 'OUT' THEN sl.qty_abs_base ELSE 0 END), 0) AS total_out_qty_base
FROM inventory_lots il
LEFT JOIN stock_ledger sl
  ON sl.lot_id = il.id
GROUP BY il.id, il.medicine_id, il.batch, il.expiry, il.pack_size;
