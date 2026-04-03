import { ArrowLeft, CreditCard, MapPin, PlusCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  pack?: string;
  stock_display?: string;
}

interface CartItem extends Medicine {
  quantity: number;
}

interface DeliveryAddress {
  id?: number;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  isDefault?: boolean;
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
  deliveryAddresses: DeliveryAddress[];
  selectedDeliveryAddressId: number | null;
  isLoadingDeliveryAddresses: boolean;
  isSavingDeliveryAddress: boolean;
  deliveryAddressError: string | null;
  onAddressChange: (field: keyof DeliveryAddress, value: string) => void;
  onSelectDeliveryAddress: (addressId: number) => void;
  onAddDeliveryAddress: () => void;
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
  deliveryAddresses,
  selectedDeliveryAddressId,
  isLoadingDeliveryAddresses,
  isSavingDeliveryAddress,
  deliveryAddressError,
  onAddressChange,
  onSelectDeliveryAddress,
  onAddDeliveryAddress,
  onBackToCart,
  onBackToStore,
  onPaymentMethodChange,
  onRegisterPaymentMethod,
  onPlaceOrder,
}: CheckoutPageProps) {
  const [showAddressForm, setShowAddressForm] = useState(false);
  const deliveryFee = totalPrice >= 499 ? 0 : 39;
  const handlingFee = totalPrice > 0 ? 9 : 0;
  const finalAmount = totalPrice + deliveryFee + handlingFee;

  useEffect(() => {
    if (deliveryAddresses.length === 0) {
      setShowAddressForm(true);
    }
  }, [deliveryAddresses.length]);

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

            {isLoadingDeliveryAddresses ? (
              <p className="text-sm text-slate-500 mt-3">Loading saved addresses...</p>
            ) : deliveryAddresses.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {deliveryAddresses.map((savedAddress) => (
                  <button
                    key={savedAddress.id}
                    type="button"
                    onClick={() => savedAddress.id && onSelectDeliveryAddress(savedAddress.id)}
                    className={`text-left border rounded-xl p-3 transition-colors ${selectedDeliveryAddressId === savedAddress.id ? 'border-[#2d7ff9] bg-[#edf4ff]' : 'border-[#d8e6fa] bg-white hover:border-[#b9d1f4]'}`}
                  >
                    <p className="text-sm font-semibold text-slate-800">{savedAddress.fullName}</p>
                    <p className="text-xs text-slate-500 mt-1">{savedAddress.phone}</p>
                    <p className="text-xs text-slate-600 mt-2">
                      {savedAddress.line1}, {savedAddress.line2 ? `${savedAddress.line2}, ` : ''}
                      {savedAddress.city}, {savedAddress.state} - {savedAddress.pincode}
                    </p>
                    {savedAddress.isDefault && <p className="text-[11px] text-teal-700 mt-2">Default</p>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">No saved addresses yet. Add your first delivery address below.</p>
            )}

            <div className="border-t border-dashed border-[#d8e6fa] mt-4 pt-4">
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#b9d1f4] bg-[#eff5ff] text-[#1d5fc7] px-4 py-2 text-sm font-medium hover:bg-[#e5f0ff] transition-colors"
              >
                <PlusCircle size={16} />
                Add New Address
              </button>
              {deliveryAddressError && !showAddressForm && <p className="text-sm text-red-600 mt-2">{deliveryAddressError}</p>}
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
            disabled={isPlacingOrder || !isPaymentMethodRegistered || !selectedDeliveryAddressId}
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

      {showAddressForm && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white border border-[#dce8fa] shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e6eef9] bg-gradient-to-r from-[#f7fbff] to-white">
              <h4 className="text-lg font-semibold text-slate-800">Add Delivery Address</h4>
              <p className="text-sm text-slate-500 mt-1">Use a complete address for faster and accurate delivery.</p>
            </div>

            <div className="p-5 grid sm:grid-cols-2 gap-3">
              <input value={address.fullName} onChange={(e) => onAddressChange('fullName', e.target.value)} placeholder="Full name" className="border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.phone} onChange={(e) => onAddressChange('phone', e.target.value)} placeholder="Phone number" className="border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.line1} onChange={(e) => onAddressChange('line1', e.target.value)} placeholder="Address line 1" className="sm:col-span-2 border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.line2} onChange={(e) => onAddressChange('line2', e.target.value)} placeholder="Address line 2" className="sm:col-span-2 border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.city} onChange={(e) => onAddressChange('city', e.target.value)} placeholder="City" className="border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.state} onChange={(e) => onAddressChange('state', e.target.value)} placeholder="State" className="border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.pincode} onChange={(e) => onAddressChange('pincode', e.target.value)} placeholder="PIN code" className="border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
              <input value={address.landmark} onChange={(e) => onAddressChange('landmark', e.target.value)} placeholder="Landmark (optional)" className="border border-[#d8e6fa] rounded-xl px-3 py-2.5" />
            </div>

            <div className="px-5 pb-5">
              {deliveryAddressError && <p className="text-sm text-red-600 mb-3">{deliveryAddressError}</p>}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddressForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#d8e6fa] text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onAddDeliveryAddress}
                  disabled={isSavingDeliveryAddress}
                  className="inline-flex items-center justify-center gap-2 bg-[#2d7ff9] text-white px-4 py-2.5 rounded-xl disabled:opacity-60"
                >
                  <PlusCircle size={16} />
                  {isSavingDeliveryAddress ? 'Saving address...' : 'Save this address'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
