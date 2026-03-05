import { MapPin, Menu, Search, ShoppingCart, User } from 'lucide-react';

interface Suggestion {
  id: number;
  name: string;
}

interface AppHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  user: any;
  totalItems: number;
  onFetchOrders: () => void;
  onFetchProfile: () => void;
  onOpenLogin: () => void;
  onOpenCart: () => void;
  location: string;
  onLocationChange: (value: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  suggestions: Suggestion[];
  onSuggestionSelect: (value: string) => void;
}

const tabs = ['Medicines', 'Lab Tests', 'Consult Doctor', 'Health Products'];

export default function AppHeader({
  searchTerm,
  onSearchChange,
  user,
  totalItems,
  onFetchOrders,
  onFetchProfile,
  onOpenLogin,
  onOpenCart,
  location,
  onLocationChange,
  activeTab,
  onTabChange,
  suggestions,
  onSuggestionSelect,
}: AppHeaderProps) {
  const handleProfileIconClick = () => {
    if (user) {
      onFetchProfile();
      return;
    }
    onOpenLogin();
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={16} className="text-teal-600" />
          <input
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="Enter delivery location"
          />
        </div>
        <p className="text-gray-500">Genuine medicines • Fast delivery • Trusted health partner</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Menu className="md:hidden" />
          <h1 className="text-2xl font-bold text-teal-600">HealthPlus</h1>
        </div>
        <div className="flex-1 max-w-md mx-4 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search medicines, healthcare products, brands..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute top-11 left-0 right-0 bg-white shadow-lg border rounded-lg z-50 max-h-56 overflow-auto">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    onClick={() => onSuggestionSelect(suggestion.name)}
                  >
                    {suggestion.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button onClick={onFetchOrders} className="text-gray-600 hover:text-teal-600">My Orders</button>
              <a href="/api/auth/logout" className="text-gray-600 hover:text-teal-600">Logout</a>
            </>
          ) : (
            <button onClick={onOpenLogin} className="text-gray-600 hover:text-teal-600">Login</button>
          )}
          <button type="button" onClick={handleProfileIconClick} className="text-gray-600 hover:text-teal-600" aria-label="Open profile">
            <User />
          </button>
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

      <nav className="max-w-7xl mx-auto px-4 pb-2 flex gap-6 overflow-auto text-sm">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`pb-2 border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-teal-600 text-teal-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </nav>
    </header>
  );
}
