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
    dl_no?: string;
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
  pack?: string;
  mrp?: number;
  discount_percent?: number;
  requires_prescription?: number | boolean;
  rating?: number;
  image_url?: string;
  delivery_eta?: string;
  mapped_rows?: number;
  last_mapped_at?: string;
  has_deal_bonus?: number | boolean;
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
  effective_rate?: number;
  gst?: number;
  dis1?: number;
  dis2?: number;
  amount?: number;
  deal?: string;
  quantity_added?: number;
  purchase_qty_entered?: number;
  purchase_qty_base?: number;
  bonus_qty?: number;
  bonus_qty_entered?: number;
  bonus_qty_base?: number;
  sold_qty_base?: number;
  pack_size?: number;
  base_uom?: string;
  pack_uom?: string;
  purchase_uom?: string;
  bonus?: number | string;
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
  dl_no?: string;
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
  calculated_discount_total?: number;
  calculated_gst_total?: number;
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
  purchase_qty_entered?: number;
  purchase_qty_base?: number;
  bonus_qty?: number;
  bonus_qty_entered?: number;
  bonus_qty_base?: number;
  sold_qty_base?: number;
  pack_size?: number;
  base_uom?: string;
  pack_uom?: string;
  purchase_uom?: string;
  bonus?: number | string;
  deal?: string;
  rate?: number;
  gst?: number;
  effective_rate?: number;
  mrp?: number;
  amount?: number;
  manufacturer?: string;
  hsn?: string;
  pack?: string;
  amount_mismatch?: boolean;
  calculated_total_rate_qty?: number;
  calculated_total_effective_qty?: number;
  created_at?: string;
}

export interface BillDetailsResponse {
  bill: Record<string, unknown>;
  medicines: BillMedicineRow[];
  summary?: {
    line_items?: number;
    total_units_added?: number;
    calculated_discount_total?: number;
    calculated_gst_total?: number;
  };
}

export interface SalesPatientRow {
  id: number;
  name: string;
  phone?: string;
  age?: number;
  gender?: string;
  address?: string;
}

export interface SalesDoctorRow {
  id: number;
  name: string;
  phone?: string;
  reg_no?: string;
  specialization?: string;
}

export interface SalesSummaryRow {
  id: number;
  invoice_no?: string;
  sale_date?: string;
  grand_total?: number;
  total_qty?: number;
  patient_id?: number;
  patient_name?: string;
  doctor_id?: number;
  doctor_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalesMedicineRow {
  id: number;
  name: string;
  brand?: string;
  price?: number;
  stock?: number;
  pack?: string;
  stock_smallest?: number;
  stock_pack_size?: number;
  stock_pack_uom?: string;
  stock_base_uom?: string;
  stock_display?: string;
  available_lots?: number;
  lot_available_qty?: number;
  nearest_expiry?: string;
  near_expiry?: boolean;
  near_expiry_days?: number | null;
}

export interface SalesLotRow {
  id: number;
  batch?: string;
  expiry?: string;
  pack?: string;
  pack_size?: number;
  base_uom?: string;
  pack_uom?: string;
  purchase_uom?: string;
  mrp?: number;
  rate?: number;
  effective_cost_price?: number;
  purchase_qty_entered?: number;
  purchase_qty_base?: number;
  bonus_qty_entered?: number;
  bonus_qty_base?: number;
  sold_qty_base?: number;
  available_qty?: number;
  available_qty_base?: number;
  available_display?: string;
  near_expiry?: boolean;
  near_expiry_days?: number | null;
}

export type AdminView = 'overview' | 'item_master' | 'sales';
