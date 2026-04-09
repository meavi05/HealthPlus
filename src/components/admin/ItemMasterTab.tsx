import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AgencyBillRow, AgencyRow, BillMedicineRow, MedicineRow, ReceiptResult } from './types';
import { formatCurrency, formatDate, formatPackSplitStock, parsePackMeta } from './utils';
import BillScannerModal from './BillScannerModal';

interface ItemMasterTabProps {
  inventoryUploadLoading: boolean;
  inventoryUploadError: string | null;
  inventoryApplyLoading: boolean;
  inventoryApplyError: string | null;
  receiptResult: ReceiptResult | null;
  itemMasterQuery: string;
  itemMasterLoading: boolean;
  itemMasterMedicines: MedicineRow[];
  allMedicines: MedicineRow[];
  allMedicinesLoading: boolean;
  agencyQuery: string;
  agenciesLoading: boolean;
  agencies: AgencyRow[];
  selectedAgency: AgencyRow | null;
  agencyBillsLoading: boolean;
  agencyBills: AgencyBillRow[];
  selectedBill: AgencyBillRow | null;
  selectedBillId: number | null;
  billDetailsLoading: boolean;
  billMedicines: BillMedicineRow[];
  billSummary: {
    line_items?: number;
    total_units_added?: number;
    calculated_discount_total?: number;
    calculated_gst_total?: number;
  } | null;
  onInventoryFileChange: (file: File | null) => void;
  onUploadInventoryReceipt: () => void;
  onItemMasterQueryChange: (query: string) => void;
  onAgencyQueryChange: (query: string) => void;
  onSelectAgency: (agency: AgencyRow) => void;
  onSelectBill: (bill: AgencyBillRow) => void;
  onApplyInventoryReview: (payload: Record<string, unknown>) => Promise<unknown>;
  onAddManualInventoryEntry: (payload: Record<string, unknown>) => Promise<unknown>;
  onFetchAgencyBillsForLinkage: (agencyId: number) => Promise<AgencyBillRow[]>;
  onBackToAgencyList: () => void;
  onBackToAgencyBills: () => void;
  onOpenBillMedicine: (line: BillMedicineRow) => void;
  onOpenMedicineDetails: (medicine: MedicineRow) => void;
}

interface ReviewRowForm {
  product: string;
  hsn: string;
  mfr: string;
  pack: string;
  qty_fr: string;
  medicine_category: string;
  medicine_type: string;
  medicine_description: string;
  medicine_uses: string;
  medicine_doses: string;
  bonus: string;
  bonus_qty: string;
  deal: string;
  batch: string;
  exp: string;
  mrp: string;
  rate: string;
  effective_cost_price: string;
  gst: string;
  dis1: string;
  dis2: string;
  amount: string;
  quantity_added?: string;
  purchase_qty_entered?: string;
  purchase_qty_base?: string;
  bonus_qty_entered?: string;
  bonus_qty_base?: string;
  pack_size?: string;
  purchase_uom?: string;
  calculated_total_rate_qty?: string;
  calculated_total_effective_qty?: string;
  amount_mismatch?: boolean;
  ambiguity_flags?: string[];
}

export default function ItemMasterTab({
  inventoryUploadLoading,
  inventoryUploadError,
  inventoryApplyLoading,
  inventoryApplyError,
  receiptResult,
  itemMasterQuery,
  itemMasterLoading,
  itemMasterMedicines,
  allMedicines,
  allMedicinesLoading,
  agencyQuery,
  agenciesLoading,
  agencies,
  selectedAgency,
  agencyBillsLoading,
  agencyBills,
  selectedBill,
  selectedBillId,
  billDetailsLoading,
  billMedicines,
  billSummary,
  onInventoryFileChange,
  onUploadInventoryReceipt,
  onItemMasterQueryChange,
  onAgencyQueryChange,
  onSelectAgency,
  onSelectBill,
  onApplyInventoryReview,
  onAddManualInventoryEntry,
  onFetchAgencyBillsForLinkage,
  onBackToAgencyList,
  onBackToAgencyBills,
  onOpenBillMedicine,
  onOpenMedicineDetails,
}: ItemMasterTabProps) {
  const parseNumeric = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatEffectiveFieldValue = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(4) : '0.0000';
  };
  const roundCurrencyValue = (value: number) => Math.round(value * 100) / 100;

  const parseQtyFr = (value: string) => {
    if (!value) return 0;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const splitIndex = trimmed.search(/[+/]/);
    const primary = splitIndex >= 0 ? trimmed.slice(0, splitIndex) : trimmed;
    return parseNumeric(primary);
  };
  const parseBonusQtyFr = (value: string) => {
    if (!value) return 0;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const splitIndex = trimmed.search(/[+/]/);
    if (splitIndex < 0) return 0;
    return parseNumeric(trimmed.slice(splitIndex + 1));
  };
  const parseBonusText = (value: string) => {
    if (!value) return 0;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const splitIndex = trimmed.search(/[+/]/);
    if (splitIndex >= 0) {
      const splitBonus = parseNumeric(trimmed.slice(splitIndex + 1));
      if (splitBonus > 0) return splitBonus;
    }
    const numericTokens = trimmed.match(/\d+(?:\.\d+)?/g);
    if (!numericTokens || numericTokens.length === 0) return 0;
    const lastToken = Number(numericTokens[numericTokens.length - 1]);
    return Number.isFinite(lastToken) ? lastToken : 0;
  };
  const extractQtyBonusPair = (value: string) => {
    if (!value) return [0, 0] as const;
    const match = value.match(/(\d+)\s*[+/]\s*(\d+)/);
    if (!match) return [0, 0] as const;
    const paid = parseNumeric(match[1] || '0');
    const bonus = parseNumeric(match[2] || '0');
    return [paid > 0 ? paid : 0, bonus > 0 ? bonus : 0] as const;
  };
  const resolveEnteredQty = (row: ReviewRowForm) => {
    const qtyAdded = parseNumeric(String(row.quantity_added ?? '0'));
    if (qtyAdded > 0) return qtyAdded;
    const entered = parseNumeric(String(row.purchase_qty_entered ?? '0'));
    if (entered > 0) return entered;
    return parseQtyFr(String(row.qty_fr || ''));
  };
  const resolveBonusQty = (row: ReviewRowForm) => {
    const entered = parseNumeric(String(row.bonus_qty_entered ?? row.bonus_qty ?? '0'));
    if (entered > 0) return entered;
    const fromQtyFr = parseBonusQtyFr(String(row.qty_fr || ''));
    if (fromQtyFr > 0) return fromQtyFr;
    return parseBonusText(String(row.bonus || ''));
  };
  const computeEffectiveCostPrice = (row: ReviewRowForm) => {
    const rate = parseNumeric(String(row.rate || '0'));
    const mrp = parseNumeric(String(row.mrp || '0'));
    const gst = parseNumeric(String(row.gst || '0'));
    const dis1 = parseNumeric(String(row.dis1 || '0'));
    const dis2 = parseNumeric(String(row.dis2 || '0'));
    const qtyFr = String(row.qty_fr || '').trim();
    const bonusText = String(row.bonus || '').trim();
    const dealText = String(row.deal || '').trim();

    const baseRate = rate > 0 ? rate : mrp;
    if (baseRate <= 0) return 0;

    let paidQty = resolveEnteredQty(row);
    let ratioPaidQty = 0;
    let bonusQtyResolved = resolveBonusQty(row);

    const [qtyPairPaid, qtyPairBonus] = extractQtyBonusPair(qtyFr);
    if (qtyPairPaid > 0 && qtyPairBonus > 0) {
      ratioPaidQty = qtyPairPaid;
      bonusQtyResolved = Math.max(bonusQtyResolved, qtyPairBonus);
    } else if ((qtyFr.includes('+') || qtyFr.includes('/')) && qtyFr.length > 0) {
      ratioPaidQty = parseQtyFr(qtyFr);
      bonusQtyResolved = Math.max(bonusQtyResolved, parseBonusQtyFr(qtyFr));
    }

    if ((bonusQtyResolved <= 0 || ratioPaidQty <= 0) && bonusText.length > 0 && (bonusText.includes('+') || bonusText.includes('/'))) {
      const [bonusPairPaid, bonusPairBonus] = extractQtyBonusPair(bonusText);
      if (bonusPairPaid > 0 && bonusPairBonus > 0) {
        ratioPaidQty = bonusPairPaid;
        bonusQtyResolved = Math.max(bonusQtyResolved, bonusPairBonus);
      } else if (ratioPaidQty <= 0) {
        ratioPaidQty = parseQtyFr(bonusText);
      }
      if (bonusPairPaid <= 0 || bonusPairBonus <= 0) {
        bonusQtyResolved = Math.max(bonusQtyResolved, parseBonusQtyFr(bonusText));
      }
    }
    if (bonusQtyResolved <= 0 && bonusText.length > 0) {
      bonusQtyResolved = Math.max(0, parseBonusText(bonusText));
    }

    if ((bonusQtyResolved <= 0 || ratioPaidQty <= 0) && dealText.length > 0 && (dealText.includes('+') || dealText.includes('/'))) {
      const [dealPairPaid, dealPairBonus] = extractQtyBonusPair(dealText);
      if (dealPairPaid > 0 && dealPairBonus > 0) {
        ratioPaidQty = dealPairPaid;
        bonusQtyResolved = Math.max(bonusQtyResolved, dealPairBonus);
      } else if (ratioPaidQty <= 0) {
        ratioPaidQty = parseQtyFr(dealText);
      }
      if (dealPairPaid <= 0 || dealPairBonus <= 0) {
        bonusQtyResolved = Math.max(bonusQtyResolved, parseBonusQtyFr(dealText));
      }
    }

    if (ratioPaidQty > 0 && paidQty <= 0) {
      paidQty = ratioPaidQty;
    }
    if (paidQty <= 0) return 0;

    const adjustmentMultiplier = (1 + (gst / 100)) * (1 - (dis1 / 100)) * (1 - (dis2 / 100));
    const adjustedRate = Math.max(0, baseRate * adjustmentMultiplier);

    if (bonusQtyResolved > 0) {
      const ratioBase = ratioPaidQty > 0 ? ratioPaidQty : paidQty;
      if (ratioBase > 0) {
        const bonusRatio = bonusQtyResolved / ratioBase;
        const earnedBonus = paidQty * bonusRatio;
        const denominator = paidQty + earnedBonus;
        if (denominator > 0) {
          return Math.max(0, adjustedRate * (paidQty / denominator));
        }
      }
    }
    return adjustedRate;
  };
  const calculatePreviewLineTotal = (row: ReviewRowForm) => {
    const qty = resolveEnteredQty(row);
    const bonusQty = resolveBonusQty(row);
    const effective = parseNumeric(String(row.effective_cost_price || '0'));
    const amount = parseNumeric(String(row.amount || '0'));
    if (effective > 0 && (qty + bonusQty) > 0) {
      return roundCurrencyValue(effective * (qty + bonusQty));
    }
    if (amount > 0) {
      return roundCurrencyValue(amount);
    }
    const rate = parseNumeric(String(row.rate || '0'));
    const gst = parseNumeric(String(row.gst || '0'));
    const dis1 = parseNumeric(String(row.dis1 || '0'));
    const dis2 = parseNumeric(String(row.dis2 || '0'));
    return roundCurrencyValue(rate * qty * (1 + gst / 100) * (1 - dis1 / 100) * (1 - dis2 / 100));
  };

  const hasDealBonusQty = (deal?: string, bonus?: unknown, qtyFr?: string) => {
    const dealText = String(deal ?? '').trim();
    const bonusText = String(bonus ?? '').trim();
    const qtyText = String(qtyFr ?? '').trim();
    const hasBonus = bonusText.length > 0 && (parseNumeric(bonusText) > 0 || /[A-Za-z+\/]/.test(bonusText));
    return dealText.length > 0 || hasBonus || qtyText.includes('+') || qtyText.includes('/');
  };

  const getPricingCheck = (row: ReviewRowForm) => {
    const qtyFromQuantity = parseNumeric(String(row.quantity_added ?? ''));
    const qtyFromEntered = parseNumeric(String(row.purchase_qty_entered ?? ''));
    const qty = qtyFromQuantity > 0
      ? qtyFromQuantity
      : (qtyFromEntered > 0 ? qtyFromEntered : parseQtyFr(row.qty_fr || ''));
    const bonusQty = resolveBonusQty(row);
    const totalQty = qty + bonusQty;
    const rate = parseNumeric(row.rate || '');
    const effectivePrice = parseNumeric(row.effective_cost_price || '');
    const amount = parseNumeric(row.amount || '');
    const calculatedRateTotal = totalQty > 0 && rate > 0 ? roundCurrencyValue(rate * totalQty) : 0;
    const calculatedEffectiveTotal = totalQty > 0 && effectivePrice > 0 ? roundCurrencyValue(effectivePrice * totalQty) : 0;
    const roundedAmount = roundCurrencyValue(amount);
    const hasRate = totalQty > 0 && rate > 0 && amount > 0;
    const hasEffectivePrice = totalQty > 0 && effectivePrice > 0 && amount > 0;
    const rateMismatch = hasRate ? calculatedRateTotal !== roundedAmount : false;
    const effectiveMismatch = hasEffectivePrice ? calculatedEffectiveTotal !== roundedAmount : false;
    const flaggedByBackend =
      row.amount_mismatch === true || (Array.isArray(row.ambiguity_flags) && row.ambiguity_flags.includes('amount_mismatch'));
    const localMismatch = rateMismatch && effectiveMismatch;
    return {
      qty,
      bonusQty,
      totalQty,
      rateMismatch,
      effectiveMismatch,
      calculatedRateTotal,
      calculatedEffectiveTotal,
      mismatch: flaggedByBackend || localMismatch,
    };
  };
  const getBillPricingCheck = (line: BillMedicineRow) => {
    const qtyFromField = parseNumeric(String(line.purchase_qty_entered ?? line.quantity_added ?? '0'));
    const qty = qtyFromField > 0 ? qtyFromField : parseQtyFr(String(line.qty_fr ?? ''));
    const bonusFromField = parseNumeric(String(line.bonus_qty_entered ?? line.bonus_qty ?? '0'));
    const bonusQtyFromQtyFr = parseBonusQtyFr(String(line.qty_fr ?? ''));
    const bonusQty = bonusFromField > 0
      ? bonusFromField
      : (bonusQtyFromQtyFr > 0 ? bonusQtyFromQtyFr : parseBonusText(String(line.bonus ?? '')));
    const totalQty = qty + bonusQty;
    const rate = Number(line.rate ?? 0);
    const effectivePrice = Number(line.effective_rate ?? 0);
    const amount = Number(line.amount ?? 0);
    const backendRateTotal = Number(line.calculated_total_rate_qty ?? 0);
    const backendEffectiveTotal = Number(line.calculated_total_effective_qty ?? 0);
    const calculatedRateTotal = backendRateTotal > 0 ? roundCurrencyValue(backendRateTotal) : (totalQty > 0 && rate > 0 ? roundCurrencyValue(rate * totalQty) : 0);
    const calculatedEffectiveTotal = backendEffectiveTotal > 0
      ? roundCurrencyValue(backendEffectiveTotal)
      : (totalQty > 0 && effectivePrice > 0 ? roundCurrencyValue(effectivePrice * totalQty) : 0);
    const roundedAmount = roundCurrencyValue(amount);
    const hasRate = totalQty > 0 && rate > 0 && amount > 0;
    const hasEffectivePrice = totalQty > 0 && effectivePrice > 0 && amount > 0;
    const rateMismatch = hasRate ? calculatedRateTotal !== roundedAmount : false;
    const effectiveMismatch = hasEffectivePrice ? calculatedEffectiveTotal !== roundedAmount : false;
    const localMismatch = rateMismatch && effectiveMismatch;
    return {
      qty,
      bonusQty,
      totalQty,
      rateMismatch,
      effectiveMismatch,
      calculatedRateTotal,
      calculatedEffectiveTotal,
      mismatch: Boolean(line.amount_mismatch) || localMismatch,
    };
  };
  const isPackMissing = (pack?: string) => String(pack ?? '').trim().length === 0;
  const isPackAmbiguous = (pack?: string) => {
    if (isPackMissing(pack)) return false;
    return Boolean(parsePackMeta(pack).ambiguous);
  };
  const [itemMasterTab, setItemMasterTab] = useState<'agencies' | 'medicines'>('agencies');
  const [showManualEntryForm, setShowManualEntryForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedUploadFileName, setSelectedUploadFileName] = useState<string>('');
  const [reviewAgency, setReviewAgency] = useState({ name: '', gstin: '', dl_no: '', phone: '', address: '' });
  const [reviewBill, setReviewBill] = useState({ invoice_no: '', bill_number: '', invoice_date: '', bill_total: '' });
  const [reviewRows, setReviewRows] = useState<ReviewRowForm[]>([]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [reviewValidationError, setReviewValidationError] = useState<string | null>(null);
  const [manualLinkageType, setManualLinkageType] = useState<'none' | 'agency' | 'bill'>('none');
  const [manualLinkageAgencyId, setManualLinkageAgencyId] = useState<number | ''>('');
  const [manualLinkageBillId, setManualLinkageBillId] = useState<number | ''>('');
  const [manualLinkageBills, setManualLinkageBills] = useState<AgencyBillRow[]>([]);
  const [manualLinkageBillsLoading, setManualLinkageBillsLoading] = useState(false);
  const [manualForm, setManualForm] = useState({
    medicine_id: '',
    medicine_name: '',
    brand: '',
    description: '',
    category: '',
    medicine_type: '',
    medicine_uses: '',
    medicine_doses: '',
    hsn: '',
    manufacturer: '',
    pack: '',
    qty_fr: '',
    batch: '',
    expiry: '',
    mrp: '',
    rate: '',
    dis1: '',
    dis2: '',
    amount: '',
    quantity_added: '',
    bonus: '',
    source: 'manual',
    invoice_no: '',
    bill_number: '',
    invoice_date: '',
    bill_total: '',
  });
  const showAgencyListPage = !selectedAgency;
  const showAgencyDetailsPage = !!selectedAgency && !selectedBill;
  const showBillDetailsPage = !!selectedAgency && !!selectedBill;

  const toReviewRow = (row: any): ReviewRowForm => ({
    product: String(row.product || row.name || ''),
    hsn: String(row.hsn || ''),
    mfr: String(row.mfr || row.manufacturer || row.brand || ''),
    pack: String(row.pack || ''),
    qty_fr: String(row.qty_fr || ''),
    medicine_category: String(row.medicine_category || row.category || ''),
    medicine_type: String(row.medicine_type || ''),
    medicine_description: String(row.medicine_description || row.description || ''),
    medicine_uses: String(row.medicine_uses || ''),
    medicine_doses: String(row.medicine_doses || ''),
    bonus: String(row.bonus ?? 0),
    bonus_qty: String(row.bonus_qty ?? 0),
    deal: String(row.deal || ''),
    batch: String(row.batch || ''),
    exp: String(row.exp || row.expiry || ''),
    mrp: String(row.mrp ?? 0),
    rate: String(row.rate ?? 0),
    effective_cost_price: formatEffectiveFieldValue(row.effective_cost_price ?? row.effective_unit_price ?? row.effective_unit_rate ?? row.effective_rate ?? 0),
    gst: String(row.gst ?? 0),
    dis1: String(row.dis1 ?? 0),
    dis2: String(row.dis2 ?? 0),
    amount: String(row.amount ?? 0),
    quantity_added: String(row.quantity_added ?? 0),
    purchase_qty_entered: String(row.purchase_qty_entered ?? row.quantity_added ?? 0),
    purchase_qty_base: String(row.purchase_qty_base ?? 0),
    bonus_qty_entered: String(row.bonus_qty_entered ?? row.bonus_qty ?? 0),
    bonus_qty_base: String(row.bonus_qty_base ?? 0),
    pack_size: String(row.pack_size ?? 1),
    purchase_uom: String(row.purchase_uom ?? ''),
    calculated_total_rate_qty: String(row.calculated_total_rate_qty ?? 0),
    calculated_total_effective_qty: String(row.calculated_total_effective_qty ?? 0),
    amount_mismatch: row.amount_mismatch === true,
    ambiguity_flags: Array.isArray(row.ambiguity_flags) ? row.ambiguity_flags.map((flag: any) => String(flag)) : [],
  });

  useEffect(() => {
    if (receiptResult?.mode === 'preview') {
      setReviewAgency({
        name: String(receiptResult.agency?.name || ''),
        gstin: String(receiptResult.agency?.gstin || ''),
        dl_no: String(receiptResult.agency?.dl_no || ''),
        phone: String(receiptResult.agency?.phone || ''),
        address: String(receiptResult.agency?.address || ''),
      });
      setReviewBill({
        invoice_no: String(receiptResult.bill?.invoice_no || ''),
        bill_number: String(receiptResult.bill?.bill_number || ''),
        invoice_date: String(receiptResult.bill?.invoice_date || ''),
        bill_total: String(receiptResult.bill?.bill_total ?? ''),
      });
      setReviewValidationError(null);
      const rows = Array.isArray(receiptResult.rows) ? receiptResult.rows : [];
      setReviewRows(rows.map((row: any) => toReviewRow(row)));
    } else if (receiptResult?.mode === 'applied') {
      // Auto-close the preview editor after successful apply.
      setReviewRows([]);
      setReviewValidationError(null);
    } else {
      setReviewRows([]);
    }
  }, [receiptResult]);

  const handleManualAgencyChange = (value: string) => {
    const agencyId = value ? Number(value) : '';
    setManualLinkageAgencyId(agencyId);
    setManualLinkageBillId('');
    setManualLinkageBills([]);
    if (!value) return;
    setManualLinkageBillsLoading(true);
    onFetchAgencyBillsForLinkage(Number(value))
      .then((rows) => setManualLinkageBills(rows))
      .catch(() => setManualLinkageBills([]))
      .finally(() => setManualLinkageBillsLoading(false));
  };

  const handleManualSubmit = () => {
    if (!manualForm.pack.trim()) {
      setManualError('Pack is required. Please add pack for this item.');
      return;
    }
    setManualSaving(true);
    setManualError(null);
    const payload: Record<string, unknown> = {
      medicine_id: manualForm.medicine_id ? Number(manualForm.medicine_id) : 0,
      medicine_name: manualForm.medicine_name,
      brand: manualForm.brand,
      description: manualForm.description,
      category: manualForm.category,
      medicine_category: manualForm.category,
      medicine_type: manualForm.medicine_type,
      medicine_description: manualForm.description,
      medicine_uses: manualForm.medicine_uses,
      medicine_doses: manualForm.medicine_doses,
      hsn: manualForm.hsn,
      manufacturer: manualForm.manufacturer,
      pack: manualForm.pack,
      qty_fr: manualForm.qty_fr,
      batch: manualForm.batch,
      expiry: manualForm.expiry,
      mrp: Number(manualForm.mrp || 0),
      rate: Number(manualForm.rate || 0),
      dis1: Number(manualForm.dis1 || 0),
      dis2: Number(manualForm.dis2 || 0),
      amount: Number(manualForm.amount || 0),
      quantity_added: Number(manualForm.quantity_added || 0),
      bonus: manualForm.bonus,
      source: manualForm.source || 'manual',
      linkage_type: manualLinkageType,
      agency_id: manualLinkageAgencyId || 0,
      bill_id: manualLinkageBillId || 0,
      invoice_no: manualForm.invoice_no,
      bill_number: manualForm.bill_number,
      invoice_date: manualForm.invoice_date,
      bill_total: Number(manualForm.bill_total || 0),
    };
    onAddManualInventoryEntry(payload)
      .then(() => {
        setShowManualEntryForm(false);
        setManualForm({
          medicine_id: '',
          medicine_name: '',
          brand: '',
          description: '',
          category: '',
          medicine_type: '',
          medicine_uses: '',
          medicine_doses: '',
          hsn: '',
          manufacturer: '',
          pack: '',
          qty_fr: '',
          batch: '',
          expiry: '',
          mrp: '',
          rate: '',
          dis1: '',
          dis2: '',
          amount: '',
          quantity_added: '',
          bonus: '',
          source: 'manual',
          invoice_no: '',
          bill_number: '',
          invoice_date: '',
          bill_total: '',
        });
        setManualLinkageType('none');
        setManualLinkageAgencyId('');
        setManualLinkageBillId('');
        setManualLinkageBills([]);
      })
      .catch((error: Error) => setManualError(error.message || 'Unable to add inventory entry'))
      .finally(() => setManualSaving(false));
  };

  const addReviewRow = () => {
    setReviewRows((rows) => [
      ...rows,
      {
        product: '',
        hsn: '',
        mfr: '',
        pack: '',
        qty_fr: '',
        quantity_added: '0',
        medicine_category: '',
        medicine_type: '',
        medicine_description: '',
        medicine_uses: '',
        medicine_doses: '',
        bonus: '0',
        bonus_qty: '0',
        deal: '',
        batch: '',
        exp: '',
        mrp: '0',
        rate: '0',
        effective_cost_price: '0',
        gst: '0',
        dis1: '0',
        dis2: '0',
        amount: '0',
      },
    ]);
  };

  const rowsMissingPack = reviewRows
    .map((row, index) => ({ index: index + 1, product: String(row.product || '').trim(), missing: isPackMissing(row.pack) }))
    .filter((entry) => entry.missing)
    .map((entry) => (entry.product ? `#${entry.index} (${entry.product})` : `#${entry.index}`));
  const hasRowsMissingPack = rowsMissingPack.length > 0;
  const rowsWithAmbiguousPack = reviewRows
    .map((row, index) => ({
      index: index + 1,
      product: String(row.product || '').trim(),
      ambiguous: isPackAmbiguous(row.pack),
    }))
    .filter((entry) => entry.ambiguous)
    .map((entry) => (entry.product ? `#${entry.index} (${entry.product})` : `#${entry.index}`));
  const hasAmbiguousPackRows = rowsWithAmbiguousPack.length > 0;
  const applyDisabledReasons: string[] = [];
  if (inventoryApplyLoading) {
    applyDisabledReasons.push('Apply is already in progress. Please wait.');
  }
  if (hasRowsMissingPack) {
    applyDisabledReasons.push(`Pack is missing for: ${rowsMissingPack.join(', ')}`);
  }
  if (hasAmbiguousPackRows) {
    applyDisabledReasons.push(`Pack format is ambiguous for: ${rowsWithAmbiguousPack.join(', ')}`);
  }
  const isPreviewMode = receiptResult?.mode === 'preview';
  const effectiveAutoFields = new Set([
    'rate',
    'mrp',
    'gst',
    'dis1',
    'dis2',
    'qty_fr',
    'quantity_added',
    'purchase_qty_entered',
    'bonus',
    'bonus_qty',
    'bonus_qty_entered',
    'deal',
  ]);
  const handleReviewRowFieldChange = (index: number, field: string, value: string) => {
    setReviewRows((rows) =>
      rows.map((entry, idx) => {
        if (idx !== index) return entry;
        const next = { ...entry, [field]: value };
        if (isPreviewMode && field !== 'effective_cost_price' && effectiveAutoFields.has(field)) {
          next.effective_cost_price = formatEffectiveFieldValue(computeEffectiveCostPrice(next));
        }
        return next;
      })
    );
  };
  const manualPackMissing = !manualForm.pack.trim();
  const previewOcrTotal = parseNumeric(reviewBill.bill_total || '');
  const previewCalculatedTotal = roundCurrencyValue(reviewRows.reduce((sum, row) => sum + calculatePreviewLineTotal(row), 0));
  const previewTotalMismatch = Math.abs(previewOcrTotal - previewCalculatedTotal) > 1;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#f7fbff] to-white rounded-2xl border border-[#d7e8ff] p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">Inventory Intake via OCR</h3>
        <p className="text-sm text-slate-500">Upload a medical agency bill. Agency and bill details are auto-linked.</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            id="inventory-bill-upload"
            type="file"
            accept="image/*,.pdf,.csv,.txt"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              onInventoryFileChange(file);
              setSelectedUploadFileName(file?.name || '');
            }}
            className="hidden"
          />
          <label htmlFor="inventory-bill-upload" className="px-3 py-2 text-sm rounded-lg border border-[#d8e6fa] bg-white text-slate-700 cursor-pointer">
            Choose File
          </label>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="px-3 py-2 text-sm rounded-lg border border-[#cfe0ff] bg-[#f5f9ff] text-[#1d5fc7]"
          >
            Scan Bill
          </button>
          <button
            type="button"
            onClick={onUploadInventoryReceipt}
            disabled={inventoryUploadLoading}
            className="px-3 py-2 text-sm rounded-lg bg-[#2d7ff9] text-white disabled:opacity-60"
          >
            {inventoryUploadLoading ? 'Running OCR Preview…' : 'Preview OCR'}
          </button>
        </div>
        {receiptResult?.mode === 'preview' && (
          <div className="space-y-1">
            <p className="text-sm text-red-600">Please verify deal/bonus and update if needed.</p>
            {hasRowsMissingPack ? (
              <p className="text-sm text-red-700">
                Pack is missing for row(s): {rowsMissingPack.join(', ')}. Please add pack before applying.
              </p>
            ) : null}
            {hasAmbiguousPackRows ? (
              <p className="text-sm text-red-700">
                Pack format is ambiguous for row(s): {rowsWithAmbiguousPack.join(', ')}. Use explicit pack text like 1x10 TAB, 100 ML, 60 GM.
              </p>
            ) : null}
          </div>
        )}
        {selectedUploadFileName && (
          <p className="text-xs text-slate-600">Selected file: <strong>{selectedUploadFileName}</strong></p>
        )}
        {inventoryUploadError && <p className="text-sm text-red-600">{inventoryUploadError}</p>}
        {receiptResult && (
          <div className="border rounded-xl p-3 bg-white text-xs text-slate-600 space-y-2">
            <p>
              {receiptResult.mode === 'preview' ? 'Preview ready:' : 'Last applied:'} <strong>{receiptResult.agency?.name || '-'}</strong> • Bill <strong>{receiptResult.bill?.invoice_no || receiptResult.bill?.bill_number || '-'}</strong>
            </p>
            {isPreviewMode && (
              <>
                <p className="text-xs text-slate-500">
                  {isPreviewMode ? 'Review and correct extracted values before applying.' : 'Applied rows with pricing checks.'}
                </p>
                {isPreviewMode && (
                  <div className="rounded-lg border border-[#e1ecff] bg-[#fbfdff] p-2.5 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Agency Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="text-xs text-slate-700">Agency Name
                        <input value={reviewAgency.name} onChange={(e) => setReviewAgency((s) => ({ ...s, name: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">GSTIN
                        <input value={reviewAgency.gstin} onChange={(e) => setReviewAgency((s) => ({ ...s, gstin: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">DL No
                        <input value={reviewAgency.dl_no} onChange={(e) => setReviewAgency((s) => ({ ...s, dl_no: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">Phone
                        <input value={reviewAgency.phone} onChange={(e) => setReviewAgency((s) => ({ ...s, phone: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">Address
                        <input value={reviewAgency.address} onChange={(e) => setReviewAgency((s) => ({ ...s, address: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                    </div>
                  </div>
                )}
                {isPreviewMode && (
                  <div className="rounded-lg border border-[#e1ecff] bg-[#fbfdff] p-2.5 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Bill Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="text-xs text-slate-700">Invoice No
                        <input value={reviewBill.invoice_no} onChange={(e) => setReviewBill((s) => ({ ...s, invoice_no: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">Bill Number
                        <input value={reviewBill.bill_number} onChange={(e) => setReviewBill((s) => ({ ...s, bill_number: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">Invoice Date
                        <input value={reviewBill.invoice_date} onChange={(e) => setReviewBill((s) => ({ ...s, invoice_date: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs text-slate-700">Bill Total
                        <input value={reviewBill.bill_total} onChange={(e) => setReviewBill((s) => ({ ...s, bill_total: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded px-2 py-1.5 text-xs" />
                      </label>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                      <span>OCR Total: <strong>{formatCurrency(previewOcrTotal)}</strong></span>
                      <span>Calculated Total: <strong>{formatCurrency(previewCalculatedTotal)}</strong></span>
                      {previewTotalMismatch ? (
                        <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Total mismatch</span>
                      ) : (
                        <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-2 py-0.5">Total matches</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-[#e1ecff] bg-[#fbfdff] p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700">Medicine Rows ({reviewRows.length})</p>
                    {isPreviewMode && (
                      <button type="button" onClick={addReviewRow} className="text-[11px] rounded border px-2 py-1">Add Row</button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[44vh] overflow-auto pr-1">
                    {reviewRows.map((row, index) => (
                      (() => {
                        const hasDealBonus = hasDealBonusQty(row.deal, row.bonus, row.qty_fr);
                        const pricingCheck = getPricingCheck(row);
                        const amountMismatch = pricingCheck.mismatch;
                        const packMissing = isPreviewMode && isPackMissing(row.pack);
                        const packAmbiguous = isPackAmbiguous(row.pack);
                        return (
                      <div
                        key={`review-row-${index}`}
                        className={`rounded border p-2 ${
                          amountMismatch || packMissing || packAmbiguous
                            ? 'border-red-300 bg-red-50'
                            : hasDealBonus
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-[#d7e7ff] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-semibold text-slate-700">Row #{index + 1}</p>
                            {amountMismatch && (
                              <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Amount mismatch</span>
                            )}
                            {pricingCheck.rateMismatch && (
                              <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Rate x (Qty+Bonus) mismatch</span>
                            )}
                            {pricingCheck.effectiveMismatch && (
                              <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Effective x (Qty+Bonus) mismatch</span>
                            )}
                            {packMissing && (
                              <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Pack missing</span>
                            )}
                            {packAmbiguous && (
                              <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Pack ambiguous</span>
                            )}
                            {hasDealBonus && (
                              <span className="text-[10px] rounded bg-amber-100 text-amber-800 px-2 py-0.5">Deal/Bonus/QTY</span>
                            )}
                          </div>
                          {isPreviewMode ? (
                            <button
                              type="button"
                              onClick={() => setReviewRows((rows) => rows.filter((_, idx) => idx !== index))}
                              className="text-[11px] rounded border border-red-300 bg-red-50 text-red-700 px-2 py-0.5"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                          <span>Qty: <strong>{pricingCheck.qty || 0}</strong></span>
                          <span>Bonus Qty: <strong>{pricingCheck.bonusQty || 0}</strong></span>
                          <span>Total Qty (Qty+Bonus): <strong>{pricingCheck.totalQty || 0}</strong></span>
                          <span>Rate x (Qty+Bonus): <strong>{pricingCheck.calculatedRateTotal > 0 ? formatCurrency(pricingCheck.calculatedRateTotal) : '-'}</strong></span>
                          <span>Effective x (Qty+Bonus): <strong>{pricingCheck.calculatedEffectiveTotal > 0 ? formatCurrency(pricingCheck.calculatedEffectiveTotal) : '-'}</strong></span>
                          <span>Total Amount: <strong>{parseNumeric(row.amount || '') > 0 ? formatCurrency(parseNumeric(row.amount || '')) : '-'}</strong></span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            ['product', 'Product'],
                            ['hsn', 'HSN'],
                            ['mfr', 'Manufacturer'],
                            ['pack', 'Pack'],
                            ['qty_fr', 'Qty+F/R'],
                            ['quantity_added', 'Qty'],
                            ['medicine_category', 'Category'],
                            ['medicine_type', 'Medicine Type'],
                            ['medicine_description', 'Description'],
                            ['medicine_uses', 'Uses'],
                            ['medicine_doses', 'Doses'],
                            ['bonus', 'Bonus'],
                            ['bonus_qty', 'Bonus Qty'],
                            ['deal', 'Deal'],
                            ['batch', 'Batch'],
                            ['exp', 'Expiry'],
                            ['mrp', 'MRP'],
                            ['rate', 'Rate'],
                            ['effective_cost_price', 'Effective Price'],
                            ['gst', 'GST %'],
                            ['dis1', 'Dis1 %'],
                            ['dis2', 'Dis2 %'],
                            ['amount', 'Total Amount'],
                          ].map(([field, label]) => (
                            <label key={`${field}-${index}`} className="text-[11px] text-slate-700">
                              {label}
                              <input
                                value={(row as any)[field]}
                                onChange={(e) => handleReviewRowFieldChange(index, field, e.target.value)}
                                disabled={!isPreviewMode}
                                className={`mt-1 w-full rounded px-2 py-1.5 text-xs ${
                                  field === 'pack' && packMissing
                                    ? 'border border-red-300 bg-red-50'
                                    : 'border border-[#d8e6fa]'
                                }`}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                        );
                      })()
                    ))}
                  </div>
                </div>
                {isPreviewMode && (reviewValidationError || inventoryApplyError) && <p className="text-sm text-red-600">{reviewValidationError || inventoryApplyError}</p>}
                {isPreviewMode && applyDisabledReasons.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
                    <p className="font-semibold">Apply is disabled for these reason(s):</p>
                    {applyDisabledReasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </div>
                )}
                {isPreviewMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (hasRowsMissingPack) {
                        setReviewValidationError('Pack is required for all rows. Please add pack and retry.');
                        return;
                      }
                      if (hasAmbiguousPackRows) {
                        setReviewValidationError('Pack format is ambiguous in one or more rows. Use explicit formats like 1x10 TAB, 100 ML, 60 GM.');
                        return;
                      }
                      setReviewValidationError(null);
                      onApplyInventoryReview({
                        agency: reviewAgency,
                        bill: {
                          ...reviewBill,
                          bill_total: Number(reviewBill.bill_total || 0),
                        },
                        rows: reviewRows.map((row) => ({
                          product: row.product,
                          hsn: row.hsn,
                          mfr: row.mfr,
                          pack: row.pack,
                          qty_fr: row.qty_fr,
                          quantity_added: Number(row.quantity_added || 0),
                          medicine_category: row.medicine_category,
                          medicine_type: row.medicine_type,
                          medicine_description: row.medicine_description,
                          medicine_uses: row.medicine_uses,
                          medicine_doses: row.medicine_doses,
                          bonus: row.bonus,
                          deal: row.deal,
                          batch: row.batch,
                          exp: row.exp,
                          mrp: Number(row.mrp || 0),
                          rate: Number(row.rate || 0),
                          effective_cost_price: Number(row.effective_cost_price || 0),
                          gst: Number(row.gst || 0),
                          dis1: Number(row.dis1 || 0),
                          dis2: Number(row.dis2 || 0),
                          amount: Number(row.amount || 0),
                          bonus_qty: Number(row.bonus_qty || 0),
                        })),
                      }).catch(() => {});
                    }}
                    disabled={applyDisabledReasons.length > 0}
                    className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-60"
                  >
                    {inventoryApplyLoading ? 'Applying...' : 'Apply to Inventory'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="border-t border-dashed border-[#d7e8ff] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Add Medicine to Inventory (Manual)</p>
            <button
              type="button"
              onClick={() => setShowManualEntryForm((value) => !value)}
              className="text-xs rounded-lg border border-[#c9ddff] bg-white px-3 py-1.5 text-[#1d5fc7]"
            >
              {showManualEntryForm ? 'Hide Form' : 'Add Entry'}
            </button>
          </div>

          {showManualEntryForm && (
            <div className="mt-3 rounded-xl border border-[#dce8fa] bg-white p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="text-xs text-slate-700">Select Existing Medicine
                  <select
                    value={manualForm.medicine_id}
                    onChange={(e) => setManualForm((s) => ({ ...s, medicine_id: e.target.value }))}
                    className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="">Create/Use by name below</option>
                    {allMedicines.map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>{medicine.name} ({medicine.brand || 'Unspecified'})</option>
                    ))}
                  </select>
                  {allMedicinesLoading && <span className="text-[11px] text-slate-500">Loading medicines...</span>}
                </label>
                <label className="text-xs text-slate-700">Medicine Name (required if no existing selected)
                  <input value={manualForm.medicine_name} onChange={(e) => setManualForm((s) => ({ ...s, medicine_name: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Brand
                  <input value={manualForm.brand} onChange={(e) => setManualForm((s) => ({ ...s, brand: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Category
                  <input value={manualForm.category} onChange={(e) => setManualForm((s) => ({ ...s, category: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Medicine Type (Standard/Ethical or Generic)
                  <input value={manualForm.medicine_type} onChange={(e) => setManualForm((s) => ({ ...s, medicine_type: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" placeholder="standard/ethical or generic" />
                </label>
                <label className="text-xs text-slate-700 md:col-span-2">Description
                  <input value={manualForm.description} onChange={(e) => setManualForm((s) => ({ ...s, description: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700 md:col-span-2">Uses
                  <input value={manualForm.medicine_uses} onChange={(e) => setManualForm((s) => ({ ...s, medicine_uses: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700 md:col-span-2">Doses (Usually Prescribed by Doctor)
                  <input value={manualForm.medicine_doses} onChange={(e) => setManualForm((s) => ({ ...s, medicine_doses: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="text-xs text-slate-700">Qty Added
                  <input value={manualForm.quantity_added} onChange={(e) => setManualForm((s) => ({ ...s, quantity_added: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Bonus
                  <input value={manualForm.bonus} onChange={(e) => setManualForm((s) => ({ ...s, bonus: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Rate
                  <input value={manualForm.rate} onChange={(e) => setManualForm((s) => ({ ...s, rate: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">MRP
                  <input value={manualForm.mrp} onChange={(e) => setManualForm((s) => ({ ...s, mrp: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="text-xs text-slate-700">HSN
                  <input value={manualForm.hsn} onChange={(e) => setManualForm((s) => ({ ...s, hsn: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Manufacturer
                  <input value={manualForm.manufacturer} onChange={(e) => setManualForm((s) => ({ ...s, manufacturer: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Pack
                  <input value={manualForm.pack} onChange={(e) => setManualForm((s) => ({ ...s, pack: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Qty+F/R
                  <input value={manualForm.qty_fr} onChange={(e) => setManualForm((s) => ({ ...s, qty_fr: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Batch
                  <input value={manualForm.batch} onChange={(e) => setManualForm((s) => ({ ...s, batch: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Expiry
                  <input value={manualForm.expiry} onChange={(e) => setManualForm((s) => ({ ...s, expiry: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Dis1
                  <input value={manualForm.dis1} onChange={(e) => setManualForm((s) => ({ ...s, dis1: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Dis2
                  <input value={manualForm.dis2} onChange={(e) => setManualForm((s) => ({ ...s, dis2: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Amount
                  <input value={manualForm.amount} onChange={(e) => setManualForm((s) => ({ ...s, amount: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
                <label className="text-xs text-slate-700">Source
                  <input value={manualForm.source} onChange={(e) => setManualForm((s) => ({ ...s, source: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                </label>
              </div>

              <div className="rounded-lg border border-[#e3edf9] bg-[#f9fbff] p-2.5">
                <p className="text-xs font-semibold text-slate-700 mb-2">Linkage</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <label className="inline-flex items-center gap-1"><input type="radio" checked={manualLinkageType === 'none'} onChange={() => setManualLinkageType('none')} /> No linkage</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" checked={manualLinkageType === 'agency'} onChange={() => setManualLinkageType('agency')} /> Link to agency (create bill)</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" checked={manualLinkageType === 'bill'} onChange={() => setManualLinkageType('bill')} /> Link to existing bill</label>
                </div>

                {(manualLinkageType === 'agency' || manualLinkageType === 'bill') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <label className="text-xs text-slate-700">Agency
                      <select
                        value={manualLinkageAgencyId}
                        onChange={(e) => handleManualAgencyChange(e.target.value)}
                        className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm bg-white"
                      >
                        <option value="">Select agency</option>
                        {agencies.map((agency) => (
                          <option key={agency.id} value={agency.id}>{agency.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {manualLinkageType === 'agency' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <label className="text-xs text-slate-700">Invoice No
                      <input value={manualForm.invoice_no} onChange={(e) => setManualForm((s) => ({ ...s, invoice_no: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Bill Number
                      <input value={manualForm.bill_number} onChange={(e) => setManualForm((s) => ({ ...s, bill_number: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Invoice Date
                      <input value={manualForm.invoice_date} onChange={(e) => setManualForm((s) => ({ ...s, invoice_date: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Bill Total
                      <input value={manualForm.bill_total} onChange={(e) => setManualForm((s) => ({ ...s, bill_total: e.target.value }))} className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                  </div>
                )}

                {manualLinkageType === 'bill' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <label className="text-xs text-slate-700">Bill
                      <select
                        value={manualLinkageBillId}
                        onChange={(e) => setManualLinkageBillId(e.target.value ? Number(e.target.value) : '')}
                        className="mt-1 w-full border border-[#d8e6fa] rounded-lg px-2.5 py-2 text-sm bg-white"
                      >
                        <option value="">Select bill</option>
                        {manualLinkageBills.map((bill) => (
                          <option key={bill.id} value={bill.id}>{bill.invoice_no || bill.bill_number || `Bill #${bill.id}`}</option>
                        ))}
                      </select>
                      {manualLinkageBillsLoading && <span className="text-[11px] text-slate-500">Loading bills...</span>}
                    </label>
                  </div>
                )}
              </div>

              {manualError && <p className="text-sm text-red-600">{manualError}</p>}
              {manualPackMissing ? <p className="text-xs text-red-700">Pack is required before adding this inventory entry.</p> : null}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={manualSaving || manualPackMissing}
                  className="rounded-lg bg-[#2d7ff9] text-white px-4 py-2 text-sm disabled:opacity-60"
                >
                  {manualSaving ? 'Adding...' : 'Add to Inventory'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showScanner && (
        <BillScannerModal
          onClose={() => setShowScanner(false)}
          onCaptured={(file) => {
            onInventoryFileChange(file);
            setSelectedUploadFileName(file.name);
          }}
        />
      )}

      <div className="bg-white rounded-2xl border border-[#dce8fa] p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f4f8ff] p-1 mb-3">
          <button
            type="button"
            onClick={() => setItemMasterTab('agencies')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${itemMasterTab === 'agencies' ? 'bg-white text-[#1d5fc7] border border-[#cfe0ff]' : 'text-slate-600'}`}
          >
            Agency Details
          </button>
          <button
            type="button"
            onClick={() => setItemMasterTab('medicines')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${itemMasterTab === 'medicines' ? 'bg-white text-[#1d5fc7] border border-[#cfe0ff]' : 'text-slate-600'}`}
          >
            All Medicines
          </button>
        </div>

        {itemMasterTab === 'agencies' && (
          <div className="p-2 sm:p-3">
            {showAgencyListPage && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">Agencies</h3>
                  <input
                    type="text"
                    value={agencyQuery}
                    onChange={(e) => onAgencyQueryChange(e.target.value)}
                    placeholder="Search agency by name, GSTIN, DL No, address..."
                    className="w-full sm:w-80 border border-[#d8e6fa] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="border rounded-xl p-2 bg-[#fbfdff] max-h-[36rem] overflow-auto">
                  {agenciesLoading ? (
                    <p className="text-sm text-slate-500 p-2">Loading agencies...</p>
                  ) : agencies.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No agencies found yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {agencies.map((agency) => (
                        <button
                          key={agency.id}
                          type="button"
                          onClick={() => onSelectAgency(agency)}
                          className="w-full text-left rounded-xl border border-[#dfebff] bg-white hover:bg-[#f6faff] px-3 py-2 transition-colors"
                        >
                          <p className="font-semibold text-sm text-slate-800">{agency.name}</p>
                          <p className="text-xs text-slate-500">GSTIN: {agency.gstin || '-'} • DL: {agency.dl_no || '-'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showAgencyDetailsPage && selectedAgency && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onBackToAgencyList}
                  className="inline-flex items-center gap-1 text-sm text-[#1d5fc7] hover:underline"
                >
                  <ArrowLeft size={14} /> Back to agencies
                </button>

                <div className="rounded-xl border border-[#dce8fa] bg-[#f8fbff] p-3">
                  <h3 className="font-semibold text-slate-800">{selectedAgency.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                    <p>GSTIN: <strong>{selectedAgency.gstin || '-'}</strong></p>
                    <p>DL No: <strong>{selectedAgency.dl_no || '-'}</strong></p>
                    <p>Phone: <strong>{selectedAgency.phone || '-'}</strong></p>
                    <p className="md:col-span-2">Address: <strong>{selectedAgency.address || '-'}</strong></p>
                    <p>Bills: <strong>{selectedAgency.bill_count ?? 0}</strong></p>
                    <p>Mapped Rows: <strong>{selectedAgency.mapped_rows ?? 0}</strong></p>
                  </div>
                </div>

                <div className="border rounded-xl p-2 bg-[#fbfdff] max-h-[34rem] overflow-auto">
                  <p className="text-sm font-semibold text-slate-800 px-2 pb-2">Bills</p>
                  {agencyBillsLoading ? (
                    <p className="text-sm text-slate-500 p-2">Loading bills...</p>
                  ) : agencyBills.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No bills found for this agency.</p>
                  ) : (
                    <div className="space-y-2">
                      {agencyBills.map((bill) => (
                        <button
                          key={bill.id}
                          type="button"
                          onClick={() => onSelectBill(bill)}
                          className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                            bill.total_mismatch
                              ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                              : selectedBillId === bill.id
                                ? 'border-[#0ea5a4] bg-[#ecfdf9]'
                                : 'border-[#dfebff] bg-white hover:bg-[#f6faff]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm text-slate-800">{bill.invoice_no || bill.bill_number || `Bill #${bill.id}`}</p>
                            {bill.total_mismatch ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-semibold">Mismatch</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Date: {bill.invoice_date || formatDate(bill.created_at)}</p>
                          <div className="mt-2 text-[11px] text-slate-600 flex flex-wrap gap-3">
                            <span>OCR Total: <strong>{formatCurrency(bill.ocr_total ?? bill.bill_total)}</strong></span>
                            <span>Calculated: <strong>{formatCurrency(bill.calculated_total)}</strong></span>
                            <span>Discount: <strong>{formatCurrency(bill.calculated_discount_total)}</strong></span>
                            <span>GST: <strong>{formatCurrency(bill.calculated_gst_total)}</strong></span>
                            <span>Rows: <strong>{bill.mapped_rows ?? 0}</strong></span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showBillDetailsPage && selectedAgency && selectedBill && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onBackToAgencyBills}
                  className="inline-flex items-center gap-1 text-sm text-[#1d5fc7] hover:underline"
                >
                  <ArrowLeft size={14} /> Back to {selectedAgency.name}
                </button>

                <div className="rounded-xl border border-[#dce8fa] bg-[#f8fbff] p-3">
                  <h3 className="font-semibold text-slate-800">{selectedBill.invoice_no || selectedBill.bill_number || `Bill #${selectedBill.id}`}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                    <p>Agency: <strong>{selectedAgency.name}</strong></p>
                    <p>Date: <strong>{selectedBill.invoice_date || formatDate(selectedBill.created_at)}</strong></p>
                    <p>OCR Total: <strong>{formatCurrency(selectedBill.ocr_total ?? selectedBill.bill_total)}</strong></p>
                    <p>Calculated Total: <strong>{formatCurrency(selectedBill.calculated_total)}</strong></p>
                    <p>Calculated Discount Total: <strong>{formatCurrency(billSummary?.calculated_discount_total ?? selectedBill.calculated_discount_total)}</strong></p>
                    <p>Calculated GST Total: <strong>{formatCurrency(billSummary?.calculated_gst_total ?? selectedBill.calculated_gst_total)}</strong></p>
                    <p>Mapped Rows: <strong>{selectedBill.mapped_rows ?? 0}</strong></p>
                  </div>
                  {selectedBill.total_mismatch ? (
                    <p className="text-xs text-amber-800 bg-amber-100 border border-amber-200 rounded-lg px-2 py-1 mt-2">
                      Bill total mismatch detected. OCR total and calculated total are different.
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500 mt-2">
                    {billSummary ? `${billSummary.line_items ?? 0} lines • ${billSummary.total_units_added ?? 0} units added` : ''}
                  </p>
                </div>

                <div className="border rounded-xl p-2 bg-[#fbfdff] max-h-[34rem] overflow-auto">
                  <p className="text-sm font-semibold text-slate-800 px-2 pb-2">Medicines From This Bill</p>
                  {billDetailsLoading ? (
                    <p className="text-sm text-slate-500 p-2">Loading bill medicines...</p>
                  ) : billMedicines.length === 0 ? (
                    <p className="text-sm text-slate-500 p-2">No mapped medicines for selected bill.</p>
                  ) : (
                    <div className="space-y-2">
                      {billMedicines.map((line) => (
                        (() => {
                          const hasDealBonus = hasDealBonusQty(line.deal, line.bonus, line.qty_fr);
                          const pricingCheck = getBillPricingCheck(line);
                          return (
                        <button
                          key={line.id}
                          type="button"
                          onClick={() => onOpenBillMedicine(line)}
                          className={`w-full text-left rounded-xl border p-2.5 ${
                            pricingCheck.mismatch
                              ? 'border-red-300 bg-red-50 hover:bg-red-100'
                              : hasDealBonus
                              ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                              : 'border-[#deebff] bg-white hover:bg-[#f4f8ff]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">{line.medicine_name}</p>
                              {pricingCheck.mismatch ? (
                                <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Amount mismatch</span>
                              ) : null}
                              {pricingCheck.rateMismatch ? (
                                <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Rate x (Qty+Bonus) mismatch</span>
                              ) : null}
                              {pricingCheck.effectiveMismatch ? (
                                <span className="text-[10px] rounded bg-red-100 text-red-700 px-2 py-0.5">Effective x (Qty+Bonus) mismatch</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">Batch {line.batch || '-'}</p>
                          </div>
                          <div className="mt-1 text-xs text-slate-600 grid grid-cols-2 md:grid-cols-8 gap-2">
                            <span>Qty: <strong>{pricingCheck.qty || 0}</strong></span>
                            <span>Bonus: <strong>{line.bonus ?? 0}</strong></span>
                            <span>Bonus Qty: <strong>{pricingCheck.bonusQty || 0}</strong></span>
                            <span>Total Qty (Qty+Bonus): <strong>{pricingCheck.totalQty || 0}</strong></span>
                            <span>Deal: <strong>{line.deal || '-'}</strong></span>
                            <span>Rate: <strong>{formatCurrency(line.rate)}</strong></span>
                            <span>MRP: <strong>{formatCurrency(line.mrp)}</strong></span>
                            <span>GST: <strong>{line.gst ?? 0}%</strong></span>
                            <span>Effective Price: <strong>{formatCurrency(line.effective_rate, 4)}</strong></span>
                            <span>Rate x (Qty+Bonus): <strong>{pricingCheck.calculatedRateTotal > 0 ? formatCurrency(pricingCheck.calculatedRateTotal) : '-'}</strong></span>
                            <span>Effective x (Qty+Bonus): <strong>{pricingCheck.calculatedEffectiveTotal > 0 ? formatCurrency(pricingCheck.calculatedEffectiveTotal) : '-'}</strong></span>
                            <span>Total Amount: <strong>{formatCurrency(line.amount)}</strong></span>
                          </div>
                        </button>
                          );
                        })()
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {itemMasterTab === 'medicines' && (
          <div className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="font-semibold text-slate-800">Mapped Medicines</h3>
              <input
                type="text"
                value={itemMasterQuery}
                onChange={(e) => onItemMasterQueryChange(e.target.value)}
                placeholder="Search medicine, brand, batch, HSN..."
                className="w-full sm:w-72 border border-[#d8e6fa] rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {itemMasterLoading ? (
              <p className="text-sm text-slate-500">Loading mapped medicines...</p>
            ) : itemMasterMedicines.length === 0 ? (
              <p className="text-sm text-slate-500">No mapped medicines found for this filter.</p>
            ) : (
              <div className="space-y-2 max-h-[52rem] overflow-auto pr-1">
                {itemMasterMedicines.map((medicine) => (
                  (() => {
                    const hasDealBonus = Boolean(medicine.has_deal_bonus);
                    return (
                  <button
                    key={medicine.id}
                    type="button"
                    onClick={() => onOpenMedicineDetails(medicine)}
                    className={`w-full text-left border rounded-xl p-3 transition-colors ${
                      hasDealBonus
                        ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                        : 'bg-slate-50 hover:bg-[#edf4ff] hover:border-[#9fc4ff]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{medicine.name}</p>
                      {hasDealBonus && (
                        <span className="text-[10px] rounded bg-amber-100 text-amber-800 px-2 py-0.5">Deal/Bonus/QTY</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                      {medicine.brand || 'Unspecified'} • {medicine.category || 'General'}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <span className="text-slate-600">Effective Price: <strong>{formatCurrency(medicine.price)}</strong></span>
                      <span className="text-slate-600">MRP: <strong>{formatCurrency(medicine.mrp)}</strong></span>
                      <span className="text-slate-600">Stock: <strong>{formatPackSplitStock(medicine.stock, medicine.pack)}</strong></span>
                      <span className="text-slate-600">Mapped rows: <strong>{medicine.mapped_rows ?? 0}</strong></span>
                    </div>
                  </button>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
