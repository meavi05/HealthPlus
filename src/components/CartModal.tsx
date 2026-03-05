import { useState } from 'react';
import { X } from 'lucide-react';

interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
}

interface CartItem extends Medicine {
  quantity: number;
}

interface CartModalProps {
  show: boolean;
  cart: CartItem[];
  totalPrice: number;
  paymentMethod: 'gpay' | 'phonepe';
  isPlacingOrder: boolean;
  orderError: string | null;
  onClose: () => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveFromCart: (id: number) => void;
  onPaymentMethodChange: (method: 'gpay' | 'phonepe') => void;
  onPlaceOrder: () => void;
}

export default function CartModal({
  show,
  cart,
  totalPrice,
  paymentMethod,
  isPlacingOrder,
  orderError,
  onClose,
  onUpdateQuantity,
  onRemoveFromCart,
  onPaymentMethodChange,
  onPlaceOrder,
}: CartModalProps) {
  const [updatedItemId, setUpdatedItemId] = useState<number | null>(null);

  if (!show) return null;

  const updateQuantityWithFeedback = (id: number, quantity: number) => {
    onUpdateQuantity(id, quantity);
    setUpdatedItemId(id);
    setTimeout(() => setUpdatedItemId(null), 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl max-w-lg w-full mx-4 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close cart">
          <X size={20} />
        </button>
        <h3 className="text-xl font-semibold mb-4">Your Cart</h3>
        {cart.length === 0 ? (
          <div className="text-center py-8">
            <p className="mb-4">Your cart is empty.</p>
            <button onClick={onClose} className="bg-teal-600 text-white px-6 py-2 rounded-lg">Continue Shopping</button>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {cart.map((item) => (
                <li key={item.id} className={`flex justify-between items-center p-2 rounded transition-colors ${updatedItemId === item.id ? 'bg-teal-50' : ''}`}>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">${item.price} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantityWithFeedback(item.id, item.quantity - 1)} className="bg-gray-200 px-2 rounded">-</button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantityWithFeedback(item.id, parseInt(e.target.value))}
                      className="w-16 text-center border rounded"
                    />
                    <button onClick={() => updateQuantityWithFeedback(item.id, item.quantity + 1)} className="bg-gray-200 px-2 rounded">+</button>
                    <button onClick={() => onRemoveFromCart(item.id)} className="text-red-500 ml-4">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t pt-4 space-y-3">
              <p className="text-lg font-bold">Total: ₹{totalPrice.toFixed(2)}</p>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Payment Options</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onPaymentMethodChange('gpay')}
                    className={`border rounded-lg px-3 py-2 text-sm font-medium ${paymentMethod === 'gpay' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-700 hover:border-teal-300'}`}
                  >
                    GPay
                  </button>
                  <button
                    type="button"
                    onClick={() => onPaymentMethodChange('phonepe')}
                    className={`border rounded-lg px-3 py-2 text-sm font-medium ${paymentMethod === 'phonepe' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-700 hover:border-teal-300'}`}
                  >
                    PhonePe
                  </button>
                </div>
              </div>

              {orderError && <p className="text-sm text-red-600">{orderError}</p>}

              <button
                type="button"
                onClick={onPlaceOrder}
                disabled={isPlacingOrder}
                className="mt-2 w-full bg-teal-600 text-white py-2 rounded-lg disabled:opacity-60"
              >
                {isPlacingOrder ? 'Placing Order...' : `Pay with ${paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'} & Place Order`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
