import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import api from '../../api/client.js';
import { Factory, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@factoryflow.in');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPassword = customPass || password;

    try {
      const res = await api.post('/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });

      login(res.token, res.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: 'ADMIN',
      name: 'Ramesh Kumar',
      email: 'admin@factoryflow.in',
      pass: 'Admin@123',
      desc: 'Approvals, GST Invoices, Dispatches, Masters',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      role: 'SALESMAN',
      name: 'Senthil Nathan',
      email: 'salesman_a@factoryflow.in',
      pass: 'Sales@123',
      desc: 'Mobile order taking for Tamil Nadu Retailer A',
      badge: 'bg-amber-100 text-amber-800',
    },
    {
      role: 'PRODUCTION_SUPERVISOR',
      name: 'Murugesan',
      email: 'supervisor@factoryflow.in',
      pass: 'Supervisor@123',
      desc: 'BOM recipe batches, yield & variance tracking',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    {
      role: 'ACCOUNTANT_AUDITOR',
      name: 'Karthik Subramanian',
      email: 'auditor@factoryflow.in',
      pass: 'Auditor@123',
      desc: 'Read-only audit registers, GSTR-1/3B, exports',
      badge: 'bg-purple-100 text-purple-800',
    },
    {
      role: 'OWNER',
      name: 'Sundaram Pillai',
      email: 'owner@factoryflow.in',
      pass: 'Owner@123',
      desc: 'Executive KPIs, packet costing & profit margins',
      badge: 'bg-rose-100 text-rose-800',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-brand-600 text-white rounded-xl shadow-lg mb-3">
          <Factory className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">FactoryFlow</h2>
        <p className="mt-1 text-sm text-gray-400">
          Order-to-Audit Management System – Packaged Food Manufacturing
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-brand-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Centre for Digital Infrastructure, NIT Tiruchirappalli
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="name@factoryflow.in"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In to Workspace'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Switcher Section */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Quick Demo Role Selector (1-Click Login)
              </span>
              <span className="text-[11px] text-brand-600 font-medium">Evaluation Mode</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.pass);
                    handleLogin(undefined, acc.email, acc.pass);
                  }}
                  className="text-left p-2.5 rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50/50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${acc.badge}`}>
                      {acc.role.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-gray-400 group-hover:text-brand-600">Click to login →</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">{acc.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">{acc.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
