import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeStyle = (s: string) => {
    switch (s.toUpperCase()) {
      case 'SUBMITTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INVOICED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'DISPATCHED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'DRAFT':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'POSTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'NORMAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'EXCEEDS_TOLERANCE':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getBadgeStyle(
        status
      )}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
};
