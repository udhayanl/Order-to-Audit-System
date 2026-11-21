import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { ShoppingCart, PlusCircle, Users, Package, ArrowRight, CheckCircle2 } from 'lucide-react';

export const SalesmanDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/orders'), api.get('/master/customers')])
      .then(([ordersData, customersData]) => {
        setOrders(ordersData);
        setCustomers(customersData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalBooked = orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
  const pendingCount = orders.filter((o) => o.status === 'SUBMITTED' || o.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {/* Mobile-friendly banner */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-100">
            Field Sales Portal
          </span>
          <h1 className="text-2xl font-bold mt-1">Vanakkam, {user?.fullName}!</h1>
          <p className="text-xs text-amber-100 mt-1">
            Capture orders on-the-go with instant pricing & GST calculation.
          </p>
        </div>
        <Link
          to="/orders/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-amber-800 text-sm font-bold rounded-xl shadow hover:bg-amber-50 transition-colors"
        >
          <PlusCircle className="w-5 h-5 text-amber-600" /> Create New Order
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Assigned Customers"
          value={customers.length}
          subtitle="Retailers & Distributors"
          icon={Users}
          color="amber"
        />
        <MetricCard
          title="Total Orders Placed"
          value={orders.length}
          subtitle={`${pendingCount} pending fulfillment`}
          icon={ShoppingCart}
          color="blue"
        />
        <MetricCard
          title="My Total Bookings"
          value={`₹${totalBooked.toLocaleString('en-IN')}`}
          subtitle="Gross order value"
          icon={Package}
          color="brand"
        />
      </div>

      {/* Order History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-600" /> My Recent Orders
          </h2>
          <Link to="/orders/new" className="text-xs font-semibold text-brand-600 hover:underline">
            + New Order
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No orders yet. Tap "Create New Order" to book your first delivery.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="text-xs font-medium text-gray-700 mt-1">{order.customer?.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(order.orderDate).toLocaleDateString()} · {order.items?.length || 0} items
                  </div>
                  {order.rejectionReason && (
                    <div className="text-[11px] text-red-600 mt-1">
                      Reason: {order.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-gray-900">
                    ₹{Number(order.grandTotal).toLocaleString('en-IN')}
                  </div>
                  <Link
                    to={`/orders/${order.id}`}
                    className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
