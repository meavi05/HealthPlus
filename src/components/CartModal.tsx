import { useState } from 'react';
import { ArrowRight, Package, ShieldCheck, X } from 'lucide-react';

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
  onClose: () => void;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveFromCart: (id: number) => void;
  onProceedToCheckout: () => void;
}

export default function CartModal({
  show,
  cart,
  totalPrice,
  onClose,
  onUpdateQuantity,
  onRemoveFromCart,
  onProceedToCheckout,
}: CartModalProps) {
  const [updatedItemId, setUpdatedItemId] = useState<number | null>(null);
  const subtotal = totalPrice;
  const deliveryFee = subtotal >= 499 ? 0 : 39;
  const handlingFee = subtotal > 0 ? 9 : 0;
  const payableAmount = subtotal + deliveryFee + handlingFee;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!show) return null;

  const updateQuantityWithFeedback = (id: number, quantity: number) => {
    onUpdateQuantity(id, quantity);
    setUpdatedItemId(id);
    setTimeout(() => setUpdatedItemId(null), 500);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7fbff] border border-[#d9e8fa] p-5 md:p-6 rounded-3xl max-w-3xl w-full mx-4 relative shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-800"
          aria-label="Close cart"
        >
          <X size={20} />
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-semibold text-slate-800">Your Cart</h3>
            <p className="text-sm text-slate-500">{itemCount} item(s) ready for checkout</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-white border border-[#dce8f9] rounded-full px-3 py-1.5">
            <ShieldCheck size={14} className="text-teal-600" />
            Secure checkout
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-10 bg-white border border-dashed border-[#d9e7fb] rounded-2xl">
            <Package size={24} className="mx-auto text-slate-400 mb-3" />
            <p className="mb-4 text-slate-600">Your cart is empty.</p>
            <button onClick={onClose} className="bg-teal-600 text-white px-6 py-2 rounded-lg">Continue Shopping</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <ul className="space-y-3 max-h-[50vh] overflow-auto pr-1">
              {cart.map((item) => (
                <li
                  key={item.id}
                  className={`bg-white border border-[#deebfb] rounded-2xl p-3 transition-colors ${updatedItemId === item.id ? 'ring-1 ring-teal-300' : ''}`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-sm text-slate-500 mt-1">₹{item.price.toFixed(2)} each</p>
                    </div>
                    <button onClick={() => onRemoveFromCart(item.id)} className="text-sm text-red-600 hover:text-red-700">Remove</button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full bg-[#eff5ff] border border-[#d6e5fa] overflow-hidden">
                      <button onClick={() => updateQuantityWithFeedback(item.id, item.quantity - 1)} className="px-3 py-1.5 text-slate-700 hover:bg-[#e7f1ff]">-</button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantityWithFeedback(item.id, parseInt(e.target.value, 10))}
                        className="w-12 text-center bg-transparent outline-none"
                      />
                      <button onClick={() => updateQuantityWithFeedback(item.id, item.quantity + 1)} className="px-3 py-1.5 text-slate-700 hover:bg-[#e7f1ff]">+</button>
                    </div>
                    <p className="font-semibold text-slate-800">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="bg-white border border-[#deebfb] rounded-2xl p-4 h-fit">
              <h4 className="text-lg font-semibold text-slate-800 mb-3">Bill details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery fee</span>
                  <span>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Handling</span>
                  <span>₹{handlingFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-dashed border-[#d5e3f8] pt-2 mt-2 flex justify-between font-semibold text-slate-800">
                  <span>Amount payable</span>
                  <span>₹{payableAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onProceedToCheckout}
                className="mt-4 w-full bg-[#2d7ff9] hover:bg-[#1f6fe6] text-white py-2.5 rounded-xl inline-flex justify-center items-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight size={16} />
              </button>
              <p className="text-xs text-slate-500 mt-2 text-center">Delivery details and payment options on next step</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
