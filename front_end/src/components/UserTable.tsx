import React from 'react';
interface UserTableProps { title: string; columns: string[]; rows: React.ReactNode[]; }
const UserTable: React.FC<UserTableProps> = ({ title, columns, rows }) => (
  <div>
    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{title}</h2>
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-slate-700 text-left text-gray-500 dark:text-gray-300 text-xs">
            {columns.map((c) => <th key={c} className="px-4 py-2 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody className="dark:text-gray-300">{rows}</tbody>
      </table>
    </div>
  </div>
);
export default UserTable;