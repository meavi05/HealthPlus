export interface AdminPanelProps {
  show: boolean;
}

export interface PrescriptionRow {
  id: number;
  user_email: string;
  status: string;
  created_at: string;
  file_count: number;
}

export interface ReceiptStep {
  stage: string;
  status: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ReceiptResult {
  mode?: 'preview' | 'applied' | string;
  message?: string;
  summary?: Record<string, unknown>;
  steps?: ReceiptStep[];
  rows?: Array<Record<string, unknown>>;
  agency?: {
    id?: number;
    name?: string;
    gstin?: string;
    phone?: string;
    address?: string;
  };
  bill?: {
    id?: number;
    invoice_no?: string;
    bill_number?: string;
    invoice_date?: string;
    bill_total?: number;
  };
}

export interface MedicineRow {
  id: number;
  name: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  brand?: string;
  mrp?: number;
  discount_percent?: number;
  requires_prescription?: number | boolean;
  rating?: number;
  image_url?: string;
  delivery_eta?: string;
  mapped_rows?: number;
  last_mapped_at?: string;
  admin_updated_at?: string;
  admin_updated_by_name?: string;
  admin_updated_by_email?: string;
}

export interface MedicineInventoryDetail {
  id: number;
  hsn?: string;
  manufacturer?: string;
  pack?: string;
  qty_fr?: string;
  medicine_category?: string;
  medicine_type?: string;
  medicine_description?: string;
  medicine_uses?: string;
  medicine_doses?: string;
  batch?: string;
  expiry?: string;
  mrp?: number;
  rate?: number;
  dis1?: number;
  dis2?: number;
  amount?: number;
  quantity_added?: number;
  bonus?: number;
  source?: string;
  created_at?: string;
  admin_updated_at?: string;
  admin_updated_by_name?: string;
  admin_updated_by_email?: string;
}

export interface MedicineDetailResponse {
  medicine: MedicineRow;
  inventory_details: MedicineInventoryDetail[];
}

export interface AgencyRow {
  id: number;
  name: string;
  gstin?: string;
  phone?: string;
  address?: string;
  bill_count?: number;
  mapped_rows?: number;
  last_bill_at?: string;
}

export interface AgencyBillRow {
  id: number;
  agency_id: number;
  invoice_no?: string;
  bill_number?: string;
  invoice_date?: string;
  bill_total?: number;
  ocr_total?: number;
  calculated_total?: number;
  total_mismatch?: number;
  file_name?: string;
  created_at?: string;
  mapped_rows?: number;
  total_units?: number;
}

export interface BillMedicineRow {
  id: number;
  medicine_id: number;
  medicine_name: string;
  medicine_brand?: string;
  batch?: string;
  expiry?: string;
  qty_fr?: string;
  quantity_added?: number;
  bonus?: number;
  effective_rate?: number;
  mrp?: number;
  amount?: number;
  manufacturer?: string;
  hsn?: string;
  pack?: string;
  created_at?: string;
}

export interface BillDetailsResponse {
  bill: Record<string, unknown>;
  medicines: BillMedicineRow[];
  summary?: {
    line_items?: number;
    total_units_added?: number;
  };
}

export type AdminView = 'overview' | 'item_master';
