ALTER TABLE medicines ADD COLUMN category TEXT;
ALTER TABLE medicines ADD COLUMN brand TEXT;
ALTER TABLE medicines ADD COLUMN mrp REAL;
ALTER TABLE medicines ADD COLUMN discount_percent INTEGER DEFAULT 0;
ALTER TABLE medicines ADD COLUMN requires_prescription INTEGER DEFAULT 0;
ALTER TABLE medicines ADD COLUMN rating REAL DEFAULT 4.0;
ALTER TABLE medicines ADD COLUMN image_url TEXT;
ALTER TABLE medicines ADD COLUMN delivery_eta TEXT DEFAULT 'Today';

UPDATE medicines SET
  category = CASE name
    WHEN 'Paracetamol' THEN 'Fever & Pain Relief'
    WHEN 'Ibuprofen' THEN 'Pain Relief'
    WHEN 'Amoxicillin' THEN 'Antibiotics'
    ELSE 'General'
  END,
  brand = CASE name
    WHEN 'Paracetamol' THEN 'Dolo'
    WHEN 'Ibuprofen' THEN 'Advil'
    WHEN 'Amoxicillin' THEN 'Mox'
    ELSE 'HealthPlus'
  END,
  mrp = ROUND(price * 1.15, 2),
  discount_percent = 15,
  requires_prescription = CASE WHEN name = 'Amoxicillin' THEN 1 ELSE 0 END,
  rating = CASE name
    WHEN 'Paracetamol' THEN 4.5
    WHEN 'Ibuprofen' THEN 4.3
    WHEN 'Amoxicillin' THEN 4.1
    ELSE 4.0
  END,
  image_url = 'https://picsum.photos/seed/' || name || '/400/300',
  delivery_eta = 'Tomorrow';
