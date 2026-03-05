import { X } from 'lucide-react';

interface OrderItem {
  id: number;
  medicine_name: string;
  quantity: number;
}

interface Order {
  id: number;
  total_price: number;
  status?: string;
  items: OrderItem[];
}

interface OrdersModalProps {
  show: boolean;
  orders: Order[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export default function OrdersModal({ show, orders, loading = false, error = null, onClose }: OrdersModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close orders">
          <X size={20} />
        </button>
        <h3 className="text-xl font-semibold mb-4">My Orders</h3>
        {loading ? (
          <p className="text-gray-600">Loading your orders...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : orders.length === 0 ? (
          <p>No orders found yet. Place an order from your cart to see it here.</p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="border-b py-2">
                <p className="font-semibold">Order #{order.id} - Total: ₹{Number(order.total_price).toFixed(2)}</p>
                <p className="text-sm">Status: <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{order.status || 'Pending'}</span></p>
                <ul className="mt-2 text-sm text-gray-600">
                  {order.items.map((item) => (
                    <li key={item.id}>{item.medicine_name} x {item.quantity}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
