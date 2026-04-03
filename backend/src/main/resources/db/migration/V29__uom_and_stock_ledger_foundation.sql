-- Strict UOM + stock-ledger foundation (backward compatible).
-- This migration introduces normalized UOMs, lot inventory, and an append-only stock ledger.
-- Existing tables stay intact so current APIs continue to work during rollout.

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_medicine_uom_medicine_code
ON medicine_uom(medicine_id, uom_code);

CREATE INDEX IF NOT EXISTS idx_medicine_uom_medicine_id
ON medicine_uom(medicine_id);

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

CREATE INDEX IF NOT EXISTS idx_inventory_lots_medicine_id
ON inventory_lots(medicine_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_agency_bill_id
ON inventory_lots(agency_bill_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_batch_expiry
ON inventory_lots(batch, expiry);

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

-- Base UOM per medicine: TAB (factor 1).
INSERT INTO medicine_uom (medicine_id, uom_code, uom_name, factor_to_base, is_base, is_active)
SELECT m.id, 'TAB', 'Tablet', 1, 1, 1
FROM medicines m
WHERE NOT EXISTS (
  SELECT 1
  FROM medicine_uom mu
  WHERE mu.medicine_id = m.id
    AND mu.uom_code = 'TAB'
);

-- Non-base UOM backfill from latest known pack text.
WITH latest_pack AS (
  SELECT m.id AS medicine_id,
         COALESCE((
           SELECT mid.pack
           FROM medicine_inventory_details mid
           WHERE mid.medicine_id = m.id
             AND TRIM(COALESCE(mid.pack, '')) <> ''
           ORDER BY mid.id DESC
           LIMIT 1
         ), '') AS pack
  FROM medicines m
),
pack_factor AS (
  SELECT medicine_id,
         CASE
           WHEN TRIM(pack) = '' THEN 1
           WHEN INSTR(UPPER(REPLACE(TRIM(pack), ' ', '')), 'X') > 0 THEN
             CAST(SUBSTR(UPPER(REPLACE(TRIM(pack), ' ', '')), INSTR(UPPER(REPLACE(TRIM(pack), ' ', '')), 'X') + 1) AS INTEGER)
           ELSE CAST(UPPER(REPLACE(TRIM(pack), ' ', '')) AS INTEGER)
         END AS factor_to_base
  FROM latest_pack
)
INSERT INTO medicine_uom (medicine_id, uom_code, uom_name, factor_to_base, is_base, is_active)
SELECT pf.medicine_id, 'STRIP', 'Strip', pf.factor_to_base, 0, 1
FROM pack_factor pf
WHERE pf.factor_to_base > 1
  AND NOT EXISTS (
    SELECT 1
    FROM medicine_uom mu
    WHERE mu.medicine_id = pf.medicine_id
      AND mu.uom_code = 'STRIP'
  );

-- Inventory lot backfill from medicine_inventory_details.
WITH normalized AS (
  SELECT
    mid.id AS inventory_detail_id,
    mid.medicine_id,
    mid.agency_bill_id,
    COALESCE(mid.batch, '') AS batch,
    COALESCE(mid.expiry, '') AS expiry,
    COALESCE(mid.pack, '') AS pack,
    UPPER(REPLACE(TRIM(COALESCE(mid.pack, '')), ' ', '')) AS pack_norm,
    MAX(0, CAST(COALESCE(mid.quantity_added, 0) AS INTEGER)) AS quantity_added_raw,
    MAX(0, CAST(COALESCE(mid.bonus_qty, 0) AS INTEGER)) AS bonus_qty_raw,
    MAX(0, CAST(COALESCE(mid.sold_qty, 0) AS INTEGER)) AS sold_qty_raw,
    TRIM(COALESCE(mid.qty_fr, '')) AS qty_fr_raw,
    COALESCE(mid.created_at, CURRENT_TIMESTAMP) AS created_at,
    COALESCE(mid.updated_at, CURRENT_TIMESTAMP) AS updated_at,
    CASE
      WHEN TRIM(COALESCE(mid.pack, '')) = '' THEN 1
      WHEN INSTR(UPPER(REPLACE(TRIM(COALESCE(mid.pack, '')), ' ', '')), 'X') > 0 THEN
        CAST(SUBSTR(UPPER(REPLACE(TRIM(COALESCE(mid.pack, '')), ' ', '')), INSTR(UPPER(REPLACE(TRIM(COALESCE(mid.pack, '')), ' ', '')), 'X') + 1) AS INTEGER)
      ELSE CAST(UPPER(REPLACE(TRIM(COALESCE(mid.pack, '')), ' ', '')) AS INTEGER)
    END AS pack_size_calc,
    CASE
      WHEN INSTR(TRIM(COALESCE(mid.qty_fr, '')), '+') > 0 THEN
        CAST(SUBSTR(TRIM(COALESCE(mid.qty_fr, '')), 1, INSTR(TRIM(COALESCE(mid.qty_fr, '')), '+') - 1) AS INTEGER)
      WHEN INSTR(TRIM(COALESCE(mid.qty_fr, '')), '/') > 0 THEN
        CAST(SUBSTR(TRIM(COALESCE(mid.qty_fr, '')), 1, INSTR(TRIM(COALESCE(mid.qty_fr, '')), '/') - 1) AS INTEGER)
      ELSE 0
    END AS qty_fr_paid,
    CASE
      WHEN INSTR(TRIM(COALESCE(mid.qty_fr, '')), '+') > 0 THEN
        CAST(SUBSTR(TRIM(COALESCE(mid.qty_fr, '')), INSTR(TRIM(COALESCE(mid.qty_fr, '')), '+') + 1) AS INTEGER)
      WHEN INSTR(TRIM(COALESCE(mid.qty_fr, '')), '/') > 0 THEN
        CAST(SUBSTR(TRIM(COALESCE(mid.qty_fr, '')), INSTR(TRIM(COALESCE(mid.qty_fr, '')), '/') + 1) AS INTEGER)
      ELSE 0
    END AS qty_fr_bonus
  FROM medicine_inventory_details mid
),
resolved AS (
  SELECT
    n.*,
    CASE WHEN n.pack_size_calc > 1 THEN n.pack_size_calc ELSE 1 END AS pack_size,
    CASE
      WHEN (CASE WHEN n.pack_size_calc > 1 THEN n.pack_size_calc ELSE 1 END) > 1
       AND (
         (n.qty_fr_paid > 0 AND n.quantity_added_raw = n.qty_fr_paid)
         OR (n.qty_fr_bonus > 0 AND n.bonus_qty_raw = n.qty_fr_bonus)
       )
      THEN 1
      ELSE 0
    END AS legacy_strip_row
  FROM normalized n
),
units AS (
  SELECT
    r.*,
    CASE WHEN r.legacy_strip_row = 1 THEN r.quantity_added_raw * r.pack_size ELSE r.quantity_added_raw END AS paid_units,
    CASE WHEN r.legacy_strip_row = 1 THEN r.bonus_qty_raw * r.pack_size ELSE r.bonus_qty_raw END AS bonus_units,
    CASE WHEN r.legacy_strip_row = 1 THEN r.sold_qty_raw * r.pack_size ELSE r.sold_qty_raw END AS sold_units_raw
  FROM resolved r
)
INSERT INTO inventory_lots (
  medicine_id,
  inventory_detail_id,
  agency_bill_id,
  batch,
  expiry,
  pack,
  pack_size,
  received_qty_base,
  bonus_qty_base,
  sold_qty_base,
  source,
  created_at,
  updated_at
)
SELECT
  u.medicine_id,
  u.inventory_detail_id,
  u.agency_bill_id,
  u.batch,
  u.expiry,
  u.pack,
  u.pack_size,
  u.paid_units,
  u.bonus_units,
  MIN((u.paid_units + u.bonus_units), u.sold_units_raw) AS sold_qty_base,
  'legacy-backfill',
  u.created_at,
  u.updated_at
FROM units u
WHERE NOT EXISTS (
  SELECT 1
  FROM inventory_lots il
  WHERE il.inventory_detail_id = u.inventory_detail_id
);

-- Ledger IN: purchase quantity from lot backfill.
INSERT INTO stock_ledger (
  medicine_id,
  lot_id,
  agency_bill_id,
  inventory_detail_id,
  movement_type,
  direction,
  qty_base,
  qty_abs_base,
  uom_code,
  factor_to_base,
  unit_price,
  source,
  notes,
  created_at
)
SELECT
  il.medicine_id,
  il.id AS lot_id,
  il.agency_bill_id,
  il.inventory_detail_id,
  'PURCHASE',
  'IN',
  il.received_qty_base,
  il.received_qty_base,
  'TAB',
  1,
  ROUND(COALESCE(mid.rate, 0), 2) AS unit_price,
  'legacy-inventory',
  'backfill from medicine_inventory_details.quantity_added',
  COALESCE(mid.created_at, CURRENT_TIMESTAMP)
FROM inventory_lots il
JOIN medicine_inventory_details mid
  ON mid.id = il.inventory_detail_id
WHERE il.received_qty_base > 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_ledger sl
    WHERE sl.inventory_detail_id = il.inventory_detail_id
      AND sl.movement_type = 'PURCHASE'
      AND sl.source = 'legacy-inventory'
  );

-- Ledger IN: bonus quantity from lot backfill.
INSERT INTO stock_ledger (
  medicine_id,
  lot_id,
  agency_bill_id,
  inventory_detail_id,
  movement_type,
  direction,
  qty_base,
  qty_abs_base,
  uom_code,
  factor_to_base,
  unit_price,
  source,
  notes,
  created_at
)
SELECT
  il.medicine_id,
  il.id AS lot_id,
  il.agency_bill_id,
  il.inventory_detail_id,
  'BONUS',
  'IN',
  il.bonus_qty_base,
  il.bonus_qty_base,
  'TAB',
  1,
  ROUND(COALESCE(mid.rate, 0), 2) AS unit_price,
  'legacy-inventory',
  'backfill from medicine_inventory_details.bonus_qty',
  COALESCE(mid.created_at, CURRENT_TIMESTAMP)
FROM inventory_lots il
JOIN medicine_inventory_details mid
  ON mid.id = il.inventory_detail_id
WHERE il.bonus_qty_base > 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_ledger sl
    WHERE sl.inventory_detail_id = il.inventory_detail_id
      AND sl.movement_type = 'BONUS'
      AND sl.source = 'legacy-inventory'
  );

-- Ledger OUT: sales quantity from historical sales items.
INSERT INTO stock_ledger (
  medicine_id,
  lot_id,
  inventory_detail_id,
  sales_entry_id,
  sales_item_id,
  movement_type,
  direction,
  qty_base,
  qty_abs_base,
  uom_code,
  factor_to_base,
  unit_price,
  source,
  notes,
  created_at
)
SELECT
  si.medicine_id,
  il.id AS lot_id,
  si.inventory_detail_id,
  si.sale_id,
  si.id AS sales_item_id,
  'SALE',
  'OUT',
  -ABS(CAST(COALESCE(si.quantity, 0) AS INTEGER)) AS qty_base,
  ABS(CAST(COALESCE(si.quantity, 0) AS INTEGER)) AS qty_abs_base,
  'TAB',
  1,
  ROUND(COALESCE(si.unit_price, 0), 2) AS unit_price,
  'legacy-sales',
  'backfill from sales_items.quantity',
  COALESCE(se.created_at, si.created_at, CURRENT_TIMESTAMP)
FROM sales_items si
LEFT JOIN inventory_lots il
  ON il.inventory_detail_id = si.inventory_detail_id
LEFT JOIN sales_entries se
  ON se.id = si.sale_id
WHERE CAST(COALESCE(si.quantity, 0) AS INTEGER) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_ledger sl
    WHERE sl.sales_item_id = si.id
      AND sl.movement_type = 'SALE'
      AND sl.source = 'legacy-sales'
  );

-- Alignment entries to keep opening ledger balance equal to medicines.stock.
WITH ledger_sum AS (
  SELECT medicine_id, COALESCE(SUM(qty_base), 0) AS ledger_stock
  FROM stock_ledger
  GROUP BY medicine_id
),
diffs AS (
  SELECT
    m.id AS medicine_id,
    (COALESCE(m.stock, 0) - COALESCE(ls.ledger_stock, 0)) AS delta
  FROM medicines m
  LEFT JOIN ledger_sum ls
    ON ls.medicine_id = m.id
)
INSERT INTO stock_ledger (
  medicine_id,
  movement_type,
  direction,
  qty_base,
  qty_abs_base,
  uom_code,
  factor_to_base,
  source,
  notes,
  created_at
)
SELECT
  d.medicine_id,
  'ADJUSTMENT',
  CASE WHEN d.delta >= 0 THEN 'IN' ELSE 'OUT' END AS direction,
  d.delta AS qty_base,
  ABS(d.delta) AS qty_abs_base,
  'TAB',
  1,
  'legacy-alignment',
  'opening alignment against medicines.stock',
  CURRENT_TIMESTAMP
FROM diffs d
WHERE d.delta <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_ledger sl
    WHERE sl.medicine_id = d.medicine_id
      AND sl.source = 'legacy-alignment'
      AND sl.movement_type = 'ADJUSTMENT'
  );

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
