import React from 'react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full py-3 px-10 text-center text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
      &copy; {year} Omollo15. All rights reserved.
    </footer>
  );
};

export default Footer;