import { useEffect, useState } from 'react';

interface AdminPanelProps {
  show: boolean;
}

interface PrescriptionRow {
  id: number;
  user_email: string;
  status: string;
  created_at: string;
  file_count: number;
}

interface InventoryBill {
  id: number;
  agency_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  status: string;
  ocr_status: string;
  created_at: string;
}

export default function AdminPanel({ show }: AdminPanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [inventoryBills, setInventoryBills] = useState<InventoryBill[]>([]);
  const [uploadingBill, setUploadingBill] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [billFile, setBillFile] = useState<File | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');

  const load = () => {
    Promise.all([
      fetch('/api/admin/users').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load users')))),
      fetch('/api/admin/orders').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load orders')))),
      fetch('/api/admin/medicines').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load medicines')))),
      fetch('/api/admin/prescriptions').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load prescriptions')))),
      fetch('/api/admin/inventory/bills').then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load inventory bills')))),
    ])
      .then(([usersData, ordersData, medicinesData, prescriptionsData, billsData]) => {
        setUsers(Array.isArray(usersData) ? usersData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setMedicines(Array.isArray(medicinesData) ? medicinesData : []);
        setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
        setInventoryBills(Array.isArray(billsData) ? billsData : []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (show) load();
  }, [show]);

  const updatePrescriptionStatus = (id: number, status: string) => {
    fetch(`/api/admin/prescriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update prescription');
        load();
      })
      .catch((err: Error) => setError(err.message));
  };

  const uploadInventoryBill = () => {
    if (!billFile) {
      setError('Please choose a bill file to upload.');
      return;
    }

    setUploadingBill(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', billFile);
    if (agencyName.trim()) formData.append('agency_name', agencyName.trim());
    if (invoiceNumber.trim()) formData.append('invoice_number', invoiceNumber.trim());
    if (invoiceDate) formData.append('invoice_date', invoiceDate);

    fetch('/api/admin/inventory/bills/upload', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to upload bill');
        }
      })
      .then(() => {
        setSuccess('Agency bill uploaded. Add bill items and import to update inventory.');
        setBillFile(null);
        setAgencyName('');
        setInvoiceNumber('');
        setInvoiceDate('');
        load();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setUploadingBill(false));
  };

  const addQuickBillItem = (billId: number) => {
    fetch(`/api/admin/inventory/bills/${billId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_medicine_name: 'New Medicine',
        normalized_medicine_name: 'New Medicine',
        quantity: 10,
        purchase_price: 10,
        mrp: 12,
        resolution_status: 'ready',
        notes: 'Created from quick-add in admin panel',
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to add bill item');
        }
      })
      .then(() => {
        setSuccess(`Added starter item to bill #${billId}. Edit through API/detail screen as needed.`);
      })
      .catch((err: Error) => setError(err.message));
  };

  const importBill = (billId: number) => {
    fetch(`/api/admin/inventory/bills/${billId}/import`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to import bill');
        }
        return res.json();
      })
      .then((data) => {
        setSuccess(`Bill #${billId} imported. Items imported: ${data.imported_items || 0}`);
        load();
      })
      .catch((err: Error) => setError(err.message));
  };

  if (!show) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-5 space-y-4">
      <div className="bg-white border border-[#dfeafb] rounded-2xl p-4 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">Admin Dashboard</h2>
        <p className="text-sm text-slate-500">Manage users, orders, medicines and review prescriptions.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">Inventory Intake (Agency Bills)</h3>
        <p className="text-sm text-slate-500">Upload agency bills, add line-items, then import to update medicine stock.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setBillFile(e.target.files?.[0] || null)} className="border rounded-lg p-2 text-sm" />
          <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Agency name" className="border rounded-lg p-2 text-sm" />
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Invoice #" className="border rounded-lg p-2 text-sm" />
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
        </div>
        <button type="button" onClick={uploadInventoryBill} disabled={uploadingBill} className="px-3 py-2 rounded-lg bg-teal-600 text-white disabled:opacity-60">
          {uploadingBill ? 'Uploading...' : 'Upload Bill'}
        </button>

        <div className="space-y-2 max-h-56 overflow-auto">
          {inventoryBills.length === 0 ? (
            <p className="text-sm text-slate-500">No uploaded bills yet.</p>
          ) : (
            inventoryBills.map((bill) => (
              <div key={bill.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">Bill #{bill.id} • {bill.agency_name || 'Unknown agency'}</p>
                  <p className="text-xs text-slate-500">Invoice: {bill.invoice_number || 'NA'} • Date: {bill.invoice_date || 'NA'}</p>
                  <p className="text-xs text-slate-500">Status: {bill.status} • OCR: {bill.ocr_status}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => addQuickBillItem(bill.id)} className="px-2 py-1 text-xs border rounded">Add Starter Item</button>
                  <button type="button" onClick={() => importBill(bill.id)} className="px-2 py-1 text-xs border rounded text-green-700">Import</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4 overflow-auto">
          <h3 className="font-semibold mb-3">Users</h3>
          <ul className="space-y-2 text-sm">
            {users.map((user) => (
              <li key={user.id} className="border rounded p-2">
                <p className="font-medium">{user.name || user.email}</p>
                <p className="text-slate-500">{user.email} • {user.role}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border p-4 overflow-auto">
          <h3 className="font-semibold mb-3">Medicines</h3>
          <ul className="space-y-2 text-sm">
            {medicines.map((medicine) => (
              <li key={medicine.id} className="border rounded p-2">
                <p className="font-medium">{medicine.name}</p>
                <p className="text-slate-500">₹{medicine.price} • Stock: {medicine.stock}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 overflow-auto">
        <h3 className="font-semibold mb-3">Orders</h3>
        <ul className="space-y-2 text-sm">
          {orders.map((order) => (
            <li key={order.id} className="border rounded p-2">
              <p className="font-medium">Order #{order.id} — ₹{order.total_price}</p>
              <p className="text-slate-500">{order.user_email} • {order.status} • {order.payment_status}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border p-4 overflow-auto">
        <h3 className="font-semibold mb-3">Prescription Review Queue</h3>
        <ul className="space-y-2 text-sm">
          {prescriptions.map((prescription) => (
            <li key={prescription.id} className="border rounded p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium">Prescription #{prescription.id} ({prescription.file_count} files)</p>
                <p className="text-slate-500">{prescription.user_email} • {prescription.status}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => updatePrescriptionStatus(prescription.id, 'in_review')} className="px-2 py-1 text-xs border rounded">In Review</button>
                <button type="button" onClick={() => updatePrescriptionStatus(prescription.id, 'approved')} className="px-2 py-1 text-xs border rounded text-green-700">Approve</button>
                <button type="button" onClick={() => updatePrescriptionStatus(prescription.id, 'rejected')} className="px-2 py-1 text-xs border rounded text-red-700">Reject</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
