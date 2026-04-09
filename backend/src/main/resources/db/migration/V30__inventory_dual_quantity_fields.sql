-- Dual quantity model with one truth:
-- *_base  => smallest unit (truth for stock math)
-- *_entered => source input as billed

ALTER TABLE medicine_inventory_details ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE medicine_inventory_details ADD COLUMN purchase_uom TEXT NOT NULL DEFAULT 'UNIT';
ALTER TABLE medicine_inventory_details ADD COLUMN purchase_qty_entered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE medicine_inventory_details ADD COLUMN purchase_qty_base INTEGER NOT NULL DEFAULT 0;
ALTER TABLE medicine_inventory_details ADD COLUMN bonus_qty_entered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE medicine_inventory_details ADD COLUMN bonus_qty_base INTEGER NOT NULL DEFAULT 0;
ALTER TABLE medicine_inventory_details ADD COLUMN sold_qty_base INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mid_purchase_qty_base
ON medicine_inventory_details(purchase_qty_base);

CREATE INDEX IF NOT EXISTS idx_mid_sold_qty_base
ON medicine_inventory_details(sold_qty_base);
