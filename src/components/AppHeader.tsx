import { Menu, Search, ShoppingCart, User } from 'lucide-react';

interface AppHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  user: any;
  totalItems: number;
  onFetchOrders: () => void;
  onFetchProfile: () => void;
  onOpenLogin: () => void;
  onOpenCart: () => void;
}

export default function AppHeader({
  searchTerm,
  onSearchChange,
  user,
  totalItems,
  onFetchOrders,
  onFetchProfile,
  onOpenLogin,
  onOpenCart,
}: AppHeaderProps) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Menu className="md:hidden" />
          <h1 className="text-2xl font-bold text-teal-600">HealthPlus</h1>
        </div>
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for medicines..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button onClick={onFetchOrders} className="text-gray-600 hover:text-teal-600">My Orders</button>
              <button onClick={onFetchProfile} className="text-gray-600 hover:text-teal-600">Profile</button>
              <a href="/api/auth/logout" className="text-gray-600 hover:text-teal-600">Logout</a>
            </>
          ) : (
            <button onClick={onOpenLogin} className="text-gray-600 hover:text-teal-600">Login</button>
          )}
          <User className="text-gray-600" />
          <div className="relative cursor-pointer" onClick={onOpenCart}>
            <ShoppingCart className="text-gray-600" />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
