import { useEffect, useState } from 'react';
import AdminHeader from './AdminHeader';
import ItemMasterTab from './ItemMasterTab';
import MedicineDetailsModal from './MedicineDetailsModal';
import OverviewTab from './OverviewTab';
import SalesTab from './SalesTab';
import {
  AgencyBillRow,
  AgencyRow,
  AdminPanelProps,
  AdminView,
  BillDetailsResponse,
  BillMedicineRow,
  MedicineDetailResponse,
  MedicineInventoryDetail,
  MedicineRow,
  PrescriptionRow,
  ReceiptResult,
} from './types';

export default function AdminPanel({ show }: AdminPanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [adminView, setAdminView] = useState<AdminView>('overview');

  const [itemMasterQuery, setItemMasterQuery] = useState('');
  const [itemMasterMedicines, setItemMasterMedicines] = useState<MedicineRow[]>([]);
  const [itemMasterLoading, setItemMasterLoading] = useState(false);
  const [allMedicines, setAllMedicines] = useState<MedicineRow[]>([]);
  const [allMedicinesLoading, setAllMedicinesLoading] = useState(false);
  const [agencyQuery, setAgencyQuery] = useState('');
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<AgencyRow | null>(null);
  const [agencyBills, setAgencyBills] = useState<AgencyBillRow[]>([]);
  const [agencyBillsLoading, setAgencyBillsLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState<AgencyBillRow | null>(null);
  const [billMedicines, setBillMedicines] = useState<BillMedicineRow[]>([]);
  const [billSummary, setBillSummary] = useState<{
    line_items?: number;
    total_units_added?: number;
    calculated_discount_total?: number;
    calculated_gst_total?: number;
  } | null>(null);
  const [billDetailsLoading, setBillDetailsLoading] = useState(false);

  const [inventoryReceiptFile, setInventoryReceiptFile] = useState<File | null>(null);
  const [inventoryUploadLoading, setInventoryUploadLoading] = useState(false);
  const [inventoryUploadError, setInventoryUploadError] = useState<string | null>(null);
  const [inventoryApplyLoading, setInventoryApplyLoading] = useState(false);
  const [inventoryApplyError, setInventoryApplyError] = useState<string | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);

  const [selectedMedicine, setSelectedMedicine] = useState<MedicineRow | null>(null);
  const [selectedMedicineDetails, setSelectedMedicineDetails] = useState<MedicineInventoryDetail[]>([]);
  const [isMedicineDetailsLoading, setIsMedicineDetailsLoading] = useState(false);
  const [medicineDetailsError, setMedicineDetailsError] = useState<string | null>(null);

  const loadOverview = () => {
    Promise.all([
      fetch('/api/admin/users').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load users')))),
      fetch('/api/admin/orders').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load orders')))),
      fetch('/api/admin/prescriptions').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load prescriptions')))),
    ])
      .then(([usersData, ordersData, prescriptionsData]) => {
        setUsers(Array.isArray(usersData) ? usersData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  const loadItemMasterMedicines = (query: string) => {
    setItemMasterLoading(true);
    fetch(`/api/admin/item-master/medicines?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load mapped medicines'))))
      .then((data) => {
        setItemMasterMedicines(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setItemMasterLoading(false));
  };

  const loadAllMedicines = () => {
    setAllMedicinesLoading(true);
    fetch('/api/admin/medicines')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load medicines'))))
      .then((data) => setAllMedicines(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setAllMedicinesLoading(false));
  };

  const loadAgencies = (query: string) => {
    setAgenciesLoading(true);
    fetch(`/api/admin/item-master/agencies?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load agencies'))))
      .then((data) => {
        const parsed = Array.isArray(data) ? data : [];
        setAgencies(parsed);
        if (parsed.length === 0 || (selectedAgency && !parsed.some((agency: AgencyRow) => agency.id === selectedAgency.id))) {
          setSelectedAgency(null);
          setAgencyBills([]);
          setSelectedBill(null);
          setBillMedicines([]);
          setBillSummary(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setAgenciesLoading(false));
  };

  const loadAgencyBills = (agencyId: number) => {
    setAgencyBillsLoading(true);
    setSelectedBill(null);
    setBillMedicines([]);
    setBillSummary(null);
    fetch(`/api/admin/item-master/agencies/${agencyId}/bills`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load bills for agency'))))
      .then((data) => {
        const parsed = Array.isArray(data) ? data : [];
        setAgencyBills(parsed);
        if (parsed.length === 0) {
          setSelectedBill(null);
          setBillMedicines([]);
          setBillSummary(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setAgencyBillsLoading(false));
  };

  const openBillDetails = (bill: AgencyBillRow) => {
    setSelectedBill(bill);
    setBillDetailsLoading(true);
    fetch(`/api/admin/item-master/bills/${bill.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load bill details'))))
      .then((data: BillDetailsResponse) => {
        if (data?.bill && typeof data.bill === 'object') {
          setSelectedBill((prev) => ({
            ...(prev || bill),
            ...((data.bill as Record<string, unknown>) as Partial<AgencyBillRow>),
          }));
        }
        setBillMedicines(Array.isArray(data.medicines) ? data.medicines : []);
        setBillSummary(data.summary || null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBillDetailsLoading(false));
  };

  useEffect(() => {
    if (!show) return;
    loadOverview();
  }, [show]);

  useEffect(() => {
    if (!show || adminView !== 'item_master') return;
    const timeout = setTimeout(() => loadItemMasterMedicines(itemMasterQuery), 200);
    return () => clearTimeout(timeout);
  }, [show, adminView, itemMasterQuery]);

  useEffect(() => {
    if (!show || adminView !== 'item_master') return;
    loadAllMedicines();
  }, [show, adminView]);

  useEffect(() => {
    if (!show || adminView !== 'item_master') return;
    const timeout = setTimeout(() => loadAgencies(agencyQuery), 200);
    return () => clearTimeout(timeout);
  }, [show, adminView, agencyQuery]);

  useEffect(() => {
    if (!selectedAgency) return;
    loadAgencyBills(selectedAgency.id);
  }, [selectedAgency?.id]);

  const updatePrescriptionStatus = (id: number, status: string) => {
    fetch(`/api/admin/prescriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update prescription');
        loadOverview();
      })
      .catch((err: Error) => setError(err.message));
  };

  const uploadInventoryReceipt = () => {
    if (!inventoryReceiptFile) {
      setInventoryUploadError('Please choose a bill receipt file first.');
      return;
    }

    setInventoryUploadLoading(true);
    setInventoryUploadError(null);
    setInventoryApplyError(null);
    setReceiptResult(null);

    const formData = new FormData();
    formData.append('file', inventoryReceiptFile);

    fetch('/api/admin/inventory/ocr-preview', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Failed to preview inventory receipt');
        }
        setReceiptResult(body);
      })
      .catch((err: Error) => setInventoryUploadError(err.message))
      .finally(() => setInventoryUploadLoading(false));
  };

  const applyReviewedInventoryReceipt = (payload: Record<string, unknown>) => {
    setInventoryApplyLoading(true);
    setInventoryApplyError(null);
    return fetch('/api/admin/inventory/ocr-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Failed to apply reviewed inventory');
        }
        return body;
      })
      .then((body) => {
        setReceiptResult(body);
        setInventoryReceiptFile(null);
        loadItemMasterMedicines(itemMasterQuery);
        loadAllMedicines();
        loadAgencies(agencyQuery);
      })
      .catch((err: Error) => {
        setInventoryApplyError(err.message);
        throw err;
      })
      .finally(() => setInventoryApplyLoading(false));
  };

  const openMedicineDetails = (medicine: MedicineRow) => {
    setSelectedMedicine(medicine);
    setIsMedicineDetailsLoading(true);
    setMedicineDetailsError(null);
    setSelectedMedicineDetails([]);

    fetch(`/api/admin/medicines/${medicine.id}`)
      .then(async (res) => {
        const body: MedicineDetailResponse | { message?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { message?: string }).message || 'Unable to load medicine details');
        }
        return body as MedicineDetailResponse;
      })
      .then((data) => {
        if (data.medicine) {
          setSelectedMedicine(data.medicine);
        }
        setSelectedMedicineDetails(Array.isArray(data.inventory_details) ? data.inventory_details : []);
      })
      .catch((err: Error) => setMedicineDetailsError(err.message))
      .finally(() => setIsMedicineDetailsLoading(false));
  };

  const saveInventoryDetail = (
    detailId: number,
    payload: {
      hsn: string;
      manufacturer: string;
      pack: string;
      qty_fr: string;
      medicine_category: string;
      medicine_type: string;
      medicine_description: string;
      medicine_uses: string;
      medicine_doses: string;
      batch: string;
      expiry: string;
      mrp: number;
      rate: number;
      gst: number;
      dis1: number;
      dis2: number;
      amount: number;
      quantity_added: number;
      bonus_qty?: number;
      purchase_qty_entered?: number;
      purchase_qty_base?: number;
      bonus_qty_entered?: number;
      bonus_qty_base?: number;
      sold_qty_base?: number;
      pack_size?: number;
      purchase_uom?: string;
      bonus: number;
      deal: string;
      source: string;
    }
  ) =>
    fetch(`/api/admin/inventory-details/${detailId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Unable to update medicine');
        }
        return body;
      })
      .then(() => {
        loadItemMasterMedicines(itemMasterQuery);
        if (selectedMedicine) {
          openMedicineDetails(selectedMedicine);
        }
        if (selectedBill) {
          openBillDetails(selectedBill);
        }
      });

  const deleteInventoryDetail = (detailId: number) =>
    fetch(`/api/admin/inventory-details/${detailId}`, {
      method: 'DELETE',
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Unable to delete inventory detail');
        }
        return body;
      })
      .then(() => {
        loadItemMasterMedicines(itemMasterQuery);
        if (selectedMedicine) {
          openMedicineDetails(selectedMedicine);
        }
        if (selectedBill) {
          openBillDetails(selectedBill);
        }
        if (selectedAgency) {
          loadAgencyBills(selectedAgency.id);
        }
      });

  const deleteMedicine = (medicineId: number) =>
    fetch(`/api/admin/medicines/${medicineId}`, {
      method: 'DELETE',
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Unable to delete medicine');
        }
        return body;
      })
      .then(() => {
        loadItemMasterMedicines(itemMasterQuery);
        loadAllMedicines();
        if (selectedBill) {
          openBillDetails(selectedBill);
        }
        if (selectedAgency) {
          loadAgencyBills(selectedAgency.id);
        }
        setSelectedMedicine(null);
        setSelectedMedicineDetails([]);
      });

  const addManualInventoryEntry = (payload: Record<string, unknown>) =>
    fetch('/api/admin/inventory/manual-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Unable to add inventory entry');
        }
        return body;
      })
      .then(() => {
        loadItemMasterMedicines(itemMasterQuery);
        loadAllMedicines();
        loadAgencies(agencyQuery);
        if (selectedAgency) {
          loadAgencyBills(selectedAgency.id);
        }
        if (selectedBill) {
          openBillDetails(selectedBill);
        }
      });

  const fetchAgencyBillsForLinkage = (agencyId: number) =>
    fetch(`/api/admin/item-master/agencies/${agencyId}/bills`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load agency bills'))))
      .then((data) => (Array.isArray(data) ? data : []));

  if (!show) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-5 space-y-4">
      <AdminHeader adminView={adminView} onViewChange={setAdminView} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adminView === 'overview' && (
        <OverviewTab
          users={users}
          orders={orders}
          prescriptions={prescriptions}
          onUpdatePrescriptionStatus={updatePrescriptionStatus}
        />
      )}

      {adminView === 'item_master' && (
        <ItemMasterTab
          inventoryUploadLoading={inventoryUploadLoading}
          inventoryUploadError={inventoryUploadError}
          inventoryApplyLoading={inventoryApplyLoading}
          inventoryApplyError={inventoryApplyError}
          receiptResult={receiptResult}
          itemMasterQuery={itemMasterQuery}
          itemMasterLoading={itemMasterLoading}
          itemMasterMedicines={itemMasterMedicines}
          allMedicines={allMedicines}
          allMedicinesLoading={allMedicinesLoading}
          agencyQuery={agencyQuery}
          agenciesLoading={agenciesLoading}
          agencies={agencies}
          selectedAgency={selectedAgency}
          agencyBillsLoading={agencyBillsLoading}
          agencyBills={agencyBills}
          selectedBill={selectedBill}
          selectedBillId={selectedBill?.id ?? null}
          billDetailsLoading={billDetailsLoading}
          billMedicines={billMedicines}
          billSummary={billSummary}
          onInventoryFileChange={setInventoryReceiptFile}
          onUploadInventoryReceipt={uploadInventoryReceipt}
          onItemMasterQueryChange={setItemMasterQuery}
          onAgencyQueryChange={setAgencyQuery}
          onSelectAgency={(agency) => setSelectedAgency(agency)}
          onSelectBill={openBillDetails}
          onApplyInventoryReview={applyReviewedInventoryReceipt}
          onAddManualInventoryEntry={addManualInventoryEntry}
          onFetchAgencyBillsForLinkage={fetchAgencyBillsForLinkage}
          onBackToAgencyList={() => {
            setSelectedAgency(null);
            setAgencyBills([]);
            setSelectedBill(null);
            setBillMedicines([]);
            setBillSummary(null);
          }}
          onBackToAgencyBills={() => {
            setSelectedBill(null);
            setBillMedicines([]);
            setBillSummary(null);
          }}
          onOpenBillMedicine={(line) =>
            openMedicineDetails({
              id: line.medicine_id,
              name: line.medicine_name,
              brand: line.medicine_brand,
            })
          }
          onOpenMedicineDetails={openMedicineDetails}
        />
      )}

      {adminView === 'sales' && <SalesTab />}

      <MedicineDetailsModal
        selectedMedicine={selectedMedicine}
        selectedMedicineDetails={selectedMedicineDetails}
        isMedicineDetailsLoading={isMedicineDetailsLoading}
        medicineDetailsError={medicineDetailsError}
        onSaveInventoryDetail={saveInventoryDetail}
        onDeleteInventoryDetail={deleteInventoryDetail}
        onDeleteMedicine={deleteMedicine}
        onClose={() => {
          setSelectedMedicine(null);
          setSelectedMedicineDetails([]);
          setMedicineDetailsError(null);
        }}
      />
    </section>
  );
}
