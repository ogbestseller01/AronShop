import React from 'react';
interface MetricCardProps { label: string; value: string | number; }
const MetricCard: React.FC<MetricCardProps> = ({ label, value }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
  </div>
);
export default MetricCard;