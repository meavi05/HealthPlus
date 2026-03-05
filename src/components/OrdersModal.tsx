import { CalendarClock, PackageCheck, ReceiptText, X } from 'lucide-react';

interface OrderItem {
  id: number;
  medicineName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  userId: number;
  totalPrice: number;
  status?: string;
  createdAt?: string;
  paymentStatus?: string;
  transactionRef?: string;
  items: OrderItem[];
}

interface OrdersModalProps {
  show: boolean;
  orders: Order[];
  loading?: boolean;
  error?: string | null;
  actionOrderId?: number | null;
  onClose: () => void;
  onCancelOrder: (orderId: number) => void;
  onRefundOrder: (orderId: number) => void;
}

const statusClassMap: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersModal({ show, orders, loading = false, error = null, actionOrderId = null, onClose, onCancelOrder, onRefundOrder }: OrdersModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-auto relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close orders">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <ReceiptText className="text-teal-600" size={20} />
          <h3 className="text-xl font-semibold">My Orders</h3>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading your orders...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : orders.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-600">
            No orders found yet. Place an order from your cart to see it here.
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => {
              const normalizedStatus = (order.status || 'pending').toLowerCase();
              const statusClasses = statusClassMap[normalizedStatus] || 'bg-gray-100 text-gray-700';

              return (
                <li key={order.id} className="border rounded-xl p-4 shadow-sm bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="font-semibold">Order #{order.id}</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses}`}>
                      {order.status || 'Pending'}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-sm mb-3">
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-gray-500">Total Amount</p>
                      <p className="font-semibold">₹{Number(order.totalPrice).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-gray-500">Items</p>
                      <p className="font-semibold flex items-center gap-1"><PackageCheck size={14} />{order.items.length}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <p className="text-gray-500">Created</p>
                      <p className="font-semibold flex items-center gap-1"><CalendarClock size={14} />{order.createdAt || '—'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {(order.transactionRef || order.paymentStatus) && (
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                        {order.paymentStatus ? `Payment: ${order.paymentStatus}` : 'Payment status unavailable'}
                        {order.transactionRef ? ` • Ref: ${order.transactionRef}` : ''}
                      </span>
                    )}
                    {!['cancelled', 'refunded'].includes(normalizedStatus) && (
                      <button
                        type="button"
                        onClick={() => onCancelOrder(order.id)}
                        disabled={actionOrderId === order.id}
                        className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded disabled:opacity-60"
                      >
                        Cancel Order
                      </button>
                    )}
                    {!['refunded'].includes(normalizedStatus) && (order.paymentStatus || '').toLowerCase() === 'authorized' && (
                      <button
                        type="button"
                        onClick={() => onRefundOrder(order.id)}
                        disabled={actionOrderId === order.id}
                        className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-1 rounded disabled:opacity-60"
                      >
                        Request Refund
                      </button>
                    )}
                  </div>

                  <ul className="mt-2 text-sm text-gray-700 divide-y bg-white rounded-lg border">
                    {order.items.map((item) => (
                      <li key={item.id} className="px-3 py-2 flex justify-between gap-4">
                        <span>{item.medicineName}</span>
                        <span className="text-gray-500">{item.quantity} x ₹{Number(item.price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
