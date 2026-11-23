import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { LogOut, User as UserIcon, Factory, Menu } from 'lucide-react';
import api from '../../api/client.js';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout, login } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SALESMAN':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'PRODUCTION_SUPERVISOR':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ACCOUNTANT_AUDITOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'OWNER':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleQuickSwitch = async (email: string) => {
    try {
      const passwords: Record<string, string> = {
        'admin@factoryflow.in': 'Admin@123',
        'salesman_a@factoryflow.in': 'Sales@123',
        'salesman_b@factoryflow.in': 'Sales@123',
        'supervisor@factoryflow.in': 'Supervisor@123',
        'auditor@factoryflow.in': 'Auditor@123',
        'owner@factoryflow.in': 'Owner@123',
      };
      const res = await api.post('/auth/login', { email, password: passwords[email] });
      login(res.token, res.user);
      window.location.href = '/dashboard';
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="p-2 -ml-1 text-gray-600 md:hidden hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="bg-brand-600 text-white p-2 rounded-lg flex items-center justify-center shadow">
          <Factory className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg text-gray-900 tracking-tight flex items-center gap-1.5">
            FactoryFlow
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-medium rounded bg-gray-100 text-gray-600 border border-gray-200">
              ERP
            </span>
          </span>
          <p className="text-xs text-gray-500 hidden sm:block">Order-to-Audit Factory Management</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Quick Demo Role Switcher for Panel */}
        <div className="flex items-center text-xs text-gray-500">
          <span className="mr-1.5 font-medium hidden lg:inline">Switch Role:</span>
          <select
            value={user?.email || ''}
            onChange={(e) => handleQuickSwitch(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[130px] sm:max-w-none"
          >
            <option value="admin@factoryflow.in">Admin</option>
            <option value="salesman_a@factoryflow.in">Salesman A</option>
            <option value="salesman_b@factoryflow.in">Salesman B</option>
            <option value="supervisor@factoryflow.in">Supervisor</option>
            <option value="auditor@factoryflow.in">Auditor</option>
            <option value="owner@factoryflow.in">Owner</option>
          </select>
        </div>

        {/* User profile & role */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-600">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-gray-800">{user?.fullName}</div>
            <div className="flex items-center justify-end gap-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${getRoleBadge(user?.role)}`}>
                {user?.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
