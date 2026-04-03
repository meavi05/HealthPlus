ALTER TABLE medicine_inventory_details ADD COLUMN medicine_name TEXT;
ALTER TABLE medicine_inventory_details ADD COLUMN brand TEXT;

UPDATE medicine_inventory_details
SET medicine_name = (
    SELECT name FROM medicines WHERE id = medicine_inventory_details.medicine_id
),
    brand = (
    SELECT brand FROM medicines WHERE id = medicine_inventory_details.medicine_id
)
WHERE (medicine_name IS NULL OR TRIM(medicine_name) = '')
   OR brand IS NULL;

CREATE INDEX IF NOT EXISTS idx_medicine_inventory_details_name_brand
ON medicine_inventory_details(medicine_name, brand);
