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
  onClose: () => void;
}

export default function OrdersModal({ show, orders, onClose }: OrdersModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4">
        <h3 className="text-xl font-semibold mb-4">My Orders</h3>
        {orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="border-b py-2">
                <p className="font-semibold">Order #{order.id} - Total: ${order.total_price}</p>
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
        <button onClick={onClose} className="mt-4 bg-gray-200 px-4 py-2 rounded">Close</button>
      </div>
    </div>
  );
}
