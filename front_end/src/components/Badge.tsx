import React from 'react';
interface BadgeProps { children: React.ReactNode; tone?: 'gray' | 'green' | 'orange' | 'red' | 'blue'; className?: string; }
const Badge: React.FC<BadgeProps> = ({ children, tone = 'gray', className = '' }) => {
  const tones = {
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    green: 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200',
    orange: 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200',
    red: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200',
    blue: 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200',
  };
  return <span className={`text-xs font-medium px-2 py-1 rounded-full ${tones[tone]} ${className}`}>{children}</span>;
};
export default Badge;