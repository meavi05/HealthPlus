# Admin Inventory Intake (Agency Bills) - Implemented Skeleton

## What was added

This change introduces a first-cut **inventory intake workflow under Admin**:

1. Upload agency bill files (PDF/JPG/JPEG/PNG, max 10MB)
2. Track uploaded bills in admin queue
3. Add/update bill line items for medicine intake
4. Import eligible items into stock
5. Record inventory movement in stock ledger

## New database tables

- `agency_bills`
  - stores uploaded bill metadata and lifecycle (`uploaded`, `reviewed`, `imported`)
- `agency_bill_items`
  - stores extracted/reviewed medicine line items and resolution status
- `medicine_stock_ledger`
  - append-only stock movement history for imports

## New Admin APIs

All under `/api/admin/inventory/*` (admin-only):

- `POST /api/admin/inventory/bills/upload`
  - multipart bill upload with optional `agency_name`, `invoice_number`, `invoice_date`
- `GET /api/admin/inventory/bills`
  - list uploaded inventory bills
- `GET /api/admin/inventory/bills/{billId}`
  - bill details + bill items
- `POST /api/admin/inventory/bills/{billId}/items`
  - add a bill item
- `PUT /api/admin/inventory/bills/{billId}/items/{itemId}`
  - update a bill item
- `POST /api/admin/inventory/bills/{billId}/import`
  - import eligible items (`ready|matched|approved`) and increase stock

## Admin UI changes

`AdminPanel` now includes **Inventory Intake (Agency Bills)**:

- upload form for bill + agency/invoice metadata
- list of bills with status/OCR state
- quick action to add starter item
- import action to push bill items to inventory

## Current limitations (intentional for skeleton)

- No OCR extraction yet (items are currently added manually/API)
- No duplicate invoice prevention logic yet
- No rollback flow yet
- Import is simple stock increment with basic medicine matching/creation

## Next recommended step

Implement OCR pipeline + structured parser to auto-create `agency_bill_items` after upload, then add confidence-based review workflow.
