import { useState } from 'react';
import { ArrowRight, Package, ShieldCheck, ShoppingBag, Trash2, X } from 'lucide-react';

interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  pack?: string;
  stock_display?: string;
  brand?: string;
  image_url?: string;
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
  const remainingForFreeDelivery = Math.max(0, 499 - subtotal);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotal / 499) * 100));

  if (!show) return null;

  const updateQuantityWithFeedback = (id: number, quantity: number) => {
    if (Number.isNaN(quantity) || quantity < 1) {
      return;
    }
    onUpdateQuantity(id, quantity);
    setUpdatedItemId(id);
    setTimeout(() => setUpdatedItemId(null), 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[3px] p-3 sm:p-4 md:p-6 flex items-center justify-center">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl border border-[#d9e8fa] bg-gradient-to-b from-[#f5faff] via-[#f8fcff] to-[#ffffff] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full bg-white/80 p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white"
          aria-label="Close cart"
        >
          <X size={20} />
        </button>

        <div className="border-b border-[#deebfb] px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-800">Your Cart</h3>
              <p className="text-sm text-slate-500">{itemCount} item{itemCount === 1 ? '' : 's'} ready for checkout</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dce8f9] bg-white px-3 py-1.5">
                <ShieldCheck size={14} className="text-teal-600" />
                Secure checkout
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dce8f9] bg-white px-3 py-1.5">
                <ShoppingBag size={14} className="text-[#2d7ff9]" />
                Easy returns
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[#dce8f9] bg-white px-3 py-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Free delivery at ₹499</span>
              <span>{freeDeliveryProgress}% reached</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8f0fc]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2d7ff9] to-[#2eb7a3] transition-all duration-300"
                style={{ width: `${freeDeliveryProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {remainingForFreeDelivery > 0
                ? `Add ₹${remainingForFreeDelivery.toFixed(2)} more to unlock free delivery.`
                : 'Free delivery unlocked for this order.'}
            </p>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-2xl border border-dashed border-[#d9e7fb] bg-white px-4 py-12 text-center">
              <Package size={28} className="mx-auto mb-3 text-slate-400" />
              <p className="mb-1 text-base font-medium text-slate-700">Your cart is empty</p>
              <p className="mb-5 text-sm text-slate-500">Add medicines to continue with checkout.</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#2d7ff9] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1f6fe6]"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <div className="grid h-[calc(92vh-180px)] grid-cols-1 gap-4 overflow-hidden p-5 sm:p-6 lg:grid-cols-[1.45fr_1fr]">
            <ul className="space-y-3 overflow-auto pr-1">
              {cart.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-2xl border border-[#deebfb] bg-white p-3 transition-all ${updatedItemId === item.id ? 'ring-2 ring-teal-200' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#dce8fb] bg-[#eef5ff]">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#2d7ff9]">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.brand || 'HealthPlus'} • ₹{item.price.toFixed(2)} each</p>
                        <p className="mt-1 text-[11px] text-slate-500">In stock: {item.stock_display || `${item.stock || 0}:0 strips`}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center overflow-hidden rounded-full border border-[#d6e5fa] bg-[#eff5ff]">
                      <button
                        type="button"
                        onClick={() => updateQuantityWithFeedback(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="px-3 py-1.5 text-slate-700 hover:bg-[#e7f1ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQuantityWithFeedback(item.id, Number.parseInt(e.target.value, 10))}
                        className="w-12 bg-transparent text-center text-sm font-semibold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantityWithFeedback(item.id, item.quantity + 1)}
                        className="px-3 py-1.5 text-slate-700 hover:bg-[#e7f1ff]"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Line total</p>
                      <p className="text-sm font-semibold text-slate-800">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="h-fit rounded-2xl border border-[#deebfb] bg-white p-4 lg:sticky lg:top-0">
              <h4 className="mb-3 text-lg font-semibold text-slate-800">Bill details</h4>
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
                <div className="mt-2 flex justify-between border-t border-dashed border-[#d5e3f8] pt-2 font-semibold text-slate-800">
                  <span>Amount payable</span>
                  <span>₹{payableAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onProceedToCheckout}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d7ff9] py-2.5 text-white hover:bg-[#1f6fe6]"
              >
                Proceed to Checkout
                <ArrowRight size={16} />
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">Delivery details and payment options on next step</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
