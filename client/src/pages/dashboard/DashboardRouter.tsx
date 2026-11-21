import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { AdminDashboard } from './AdminDashboard.js';
import { SalesmanDashboard } from './SalesmanDashboard.js';
import { ProductionDashboard } from './ProductionDashboard.js';
import { AuditorDashboard } from './AuditorDashboard.js';
import { OwnerDashboard } from './OwnerDashboard.js';

export const DashboardRouter: React.FC = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'SALESMAN':
      return <SalesmanDashboard />;
    case 'PRODUCTION_SUPERVISOR':
      return <ProductionDashboard />;
    case 'ACCOUNTANT_AUDITOR':
      return <AuditorDashboard />;
    case 'OWNER':
      return <OwnerDashboard />;
    case 'ADMIN':
    default:
      return <AdminDashboard />;
  }
};
