ALTER TABLE medicine_inventory_details ADD COLUMN sold_qty INTEGER NOT NULL DEFAULT 0;

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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_sales_entries_invoice_no ON sales_entries(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_entries_sale_date ON sales_entries(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_entries_patient_id ON sales_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_sales_entries_doctor_id ON sales_entries(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_medicine_id ON sales_items(medicine_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_inventory_detail_id ON sales_items(inventory_detail_id);
CREATE INDEX IF NOT EXISTS idx_patients_name_phone ON patients(name, phone);
CREATE INDEX IF NOT EXISTS idx_doctors_name_phone ON doctors(name, phone);
