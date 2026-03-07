import { ArrowLeft, CreditCard, MapPin, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

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

interface DeliveryAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

interface CheckoutPageProps {
  cart: CartItem[];
  totalPrice: number;
  paymentMethod: 'gpay' | 'phonepe';
  isPlacingOrder: boolean;
  orderError: string | null;
  isPaymentMethodRegistered: boolean;
  isLoadingPaymentMethods: boolean;
  isRegisteringPaymentMethod: boolean;
  paymentRegistrationError: string | null;
  address: DeliveryAddress;
  onAddressChange: (field: keyof DeliveryAddress, value: string) => void;
  onBackToCart: () => void;
  onBackToStore: () => void;
  onPaymentMethodChange: (method: 'gpay' | 'phonepe') => void;
  onRegisterPaymentMethod: (method: 'gpay' | 'phonepe', upiId: string) => void;
  onPlaceOrder: () => void;
}

export default function CheckoutPage({
  cart,
  totalPrice,
  paymentMethod,
  isPlacingOrder,
  orderError,
  isPaymentMethodRegistered,
  isLoadingPaymentMethods,
  isRegisteringPaymentMethod,
  paymentRegistrationError,
  address,
  onAddressChange,
  onBackToCart,
  onBackToStore,
  onPaymentMethodChange,
  onRegisterPaymentMethod,
  onPlaceOrder,
}: CheckoutPageProps) {
  const deliveryFee = totalPrice >= 499 ? 0 : 39;
  const handlingFee = totalPrice > 0 ? 9 : 0;
  const finalAmount = totalPrice + deliveryFee + handlingFee;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-5">
        <button type="button" onClick={onBackToStore} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#dce8fa] text-slate-700">
          <ArrowLeft size={16} />
          Continue shopping
        </button>
        <button type="button" onClick={onBackToCart} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#dce8fa] text-slate-700">
          <ArrowLeft size={16} />
          Back to cart
        </button>
      </div>

      <div className="bg-white border border-[#dce8fa] rounded-3xl p-4 md:p-6 mb-5">
        <h2 className="text-2xl font-semibold text-slate-800">Checkout</h2>
        <p className="text-sm text-slate-500 mt-1">Review your order, confirm delivery address, and complete payment.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <div className="bg-white border border-[#dce8fa] rounded-2xl p-4 md:p-5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <MapPin size={18} className="text-[#2d7ff9]" />
              Delivery Address
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <input value={address.fullName} onChange={(e) => onAddressChange('fullName', e.target.value)} placeholder="Full name" className="border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.phone} onChange={(e) => onAddressChange('phone', e.target.value)} placeholder="Phone number" className="border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.line1} onChange={(e) => onAddressChange('line1', e.target.value)} placeholder="Address line 1" className="sm:col-span-2 border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.line2} onChange={(e) => onAddressChange('line2', e.target.value)} placeholder="Address line 2" className="sm:col-span-2 border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.city} onChange={(e) => onAddressChange('city', e.target.value)} placeholder="City" className="border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.state} onChange={(e) => onAddressChange('state', e.target.value)} placeholder="State" className="border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.pincode} onChange={(e) => onAddressChange('pincode', e.target.value)} placeholder="PIN code" className="border border-[#d8e6fa] rounded-xl px-3 py-2" />
              <input value={address.landmark} onChange={(e) => onAddressChange('landmark', e.target.value)} placeholder="Landmark (optional)" className="border border-[#d8e6fa] rounded-xl px-3 py-2" />
            </div>
          </div>

          <div className="bg-white border border-[#dce8fa] rounded-2xl p-4 md:p-5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <CreditCard size={18} className="text-[#2d7ff9]" />
              Payment Method
            </h3>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => onPaymentMethodChange('gpay')}
                className={`border rounded-xl px-3 py-2 text-sm font-medium ${paymentMethod === 'gpay' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-700 hover:border-teal-300'}`}
              >
                GPay
              </button>
              <button
                type="button"
                onClick={() => onPaymentMethodChange('phonepe')}
                className={`border rounded-xl px-3 py-2 text-sm font-medium ${paymentMethod === 'phonepe' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-700 hover:border-teal-300'}`}
              >
                PhonePe
              </button>
            </div>

            {isLoadingPaymentMethods ? (
              <p className="text-sm text-gray-500 mt-3">Checking registered payment methods...</p>
            ) : isPaymentMethodRegistered ? (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 mt-3">
                {paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'} is registered and ready.
              </p>
            ) : (
              <PaymentMethodRegistration
                paymentMethod={paymentMethod}
                isRegisteringPaymentMethod={isRegisteringPaymentMethod}
                paymentRegistrationError={paymentRegistrationError}
                onRegisterPaymentMethod={onRegisterPaymentMethod}
              />
            )}
          </div>
        </section>

        <aside className="bg-white border border-[#dce8fa] rounded-2xl p-4 md:p-5 h-fit">
          <h3 className="font-semibold text-slate-800">Order Summary</h3>
          <ul className="mt-3 space-y-3 max-h-[34vh] overflow-auto pr-1">
            {cart.map((item) => (
              <li key={item.id} className="flex justify-between text-sm border-b border-dashed border-[#e6eef9] pb-2">
                <span className="text-slate-600">{item.name} x {item.quantity}</span>
                <span className="font-medium text-slate-800">₹{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Items total</span>
              <span>₹{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery fee</span>
              <span>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Handling fee</span>
              <span>₹{handlingFee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-dashed border-[#d8e6fa] flex justify-between text-base font-semibold text-slate-800">
              <span>Total payable</span>
              <span>₹{finalAmount.toFixed(2)}</span>
            </div>
          </div>

          {orderError && <p className="text-sm text-red-600 mt-3">{orderError}</p>}

          <button
            type="button"
            onClick={onPlaceOrder}
            disabled={isPlacingOrder || !isPaymentMethodRegistered}
            className="mt-4 w-full bg-[#2d7ff9] text-white py-2.5 rounded-xl disabled:opacity-60"
          >
            {isPlacingOrder ? 'Placing Order...' : `Pay with ${paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'} • ₹${finalAmount.toFixed(2)}`}
          </button>
          <p className="text-xs text-slate-500 mt-2 inline-flex gap-1 items-center">
            <ShieldCheck size={12} />
            Secure transaction, encrypted checkout
          </p>
        </aside>
      </div>
    </main>
  );
}

function PaymentMethodRegistration({
  paymentMethod,
  isRegisteringPaymentMethod,
  paymentRegistrationError,
  onRegisterPaymentMethod,
}: {
  paymentMethod: 'gpay' | 'phonepe';
  isRegisteringPaymentMethod: boolean;
  paymentRegistrationError: string | null;
  onRegisterPaymentMethod: (method: 'gpay' | 'phonepe', upiId: string) => void;
}) {
  const [upiId, setUpiId] = useState('');

  return (
    <div className="space-y-2 border border-amber-200 bg-amber-50 rounded p-3 mt-3">
      <p className="text-sm text-amber-800">Register {paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'} before payment.</p>
      <input
        type="text"
        value={upiId}
        onChange={(e) => setUpiId(e.target.value)}
        placeholder="Enter UPI ID (e.g. name@okbank)"
        className="w-full border rounded px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => onRegisterPaymentMethod(paymentMethod, upiId)}
        disabled={isRegisteringPaymentMethod || !upiId.trim()}
        className="w-full bg-amber-600 text-white py-2 rounded text-sm disabled:opacity-60"
      >
        {isRegisteringPaymentMethod ? 'Registering...' : `Register ${paymentMethod === 'gpay' ? 'GPay' : 'PhonePe'}`}
      </button>
      {paymentRegistrationError && <p className="text-sm text-red-600">{paymentRegistrationError}</p>}
    </div>
  );
}
