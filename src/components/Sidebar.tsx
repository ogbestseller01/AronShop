// src/components/Sidebar.tsx
import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  Package,
  BarChart3,
  ClipboardList,
  LogOut,
  Key,
  Warehouse,
  FileText,
  KeyRound,
  ShieldAlert,
  Building2,
  Tag,
} from 'lucide-react';
import Badge from './Badge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  collapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
}

// 🔐 All possible sidebar items with required permissions
const ALL_NAV_ITEMS = [
  { key: 'overview', labelKey: 'dashboard', icon: Home, permission: 'dashboard.main.view', path: '/' },
  { key: 'users', labelKey: 'users', icon: Users, permission: 'users.view', path: '/users' },
  { key: 'shops', labelKey: 'shops', icon: Warehouse, permission: 'warehouses.view', path: '/shops' },
  { key: 'products', labelKey: 'products', icon: Package, permission: 'products.view', path: '/products' },
  { key: 'sales', labelKey: 'sales', icon: ClipboardList, permission: 'sales.view', path: '/sales' },
  { key: 'analysis', labelKey: 'analysis', icon: BarChart3, permission: 'reports.sales.view', path: '/analysis' },
  { key: 'reports', labelKey: 'reports', icon: BarChart3, permission: 'reports.view', path: '/reports' },
  { key: 'roles', labelKey: 'roles', icon: Users, permission: 'roles.view', path: '/roles' },
  { key: 'permissions', labelKey: 'permissions', icon: Key, permission: 'permissions.view', path: '/permissions' },
  { key: 'audit', labelKey: 'audit_trail', icon: FileText, permission: 'audit.view', path: '/audit' },
  { key: 'otp', labelKey: 'otp_management', icon: KeyRound, permission: 'otp.view', path: '/otp' },
  { key: 'failed_logins', labelKey: 'failed_logins', icon: ShieldAlert, permission: 'failed_logins.view', path: '/failed-logins' },
  { key: 'companies', labelKey: 'companies', icon: Building2, permission: 'companies.view', path: '/companies' },
  { key: 'categories', labelKey: 'product_categories', icon: Tag, permission: 'categories.view', path: '/categories' },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, isMobile, onClose }) => {
  const { t } = useLanguage();
  const { role, hasPermission } = useAuth();

  // 🔒 Only ADMINISTRATOR and MANAGER can see these items
  const restrictedKeys = ['users', 'categories', 'companies', 'permissions'];
  const isAdminOrManager = role?.name === 'ADMINISTRATOR' || role?.name === 'MANAGER';

  // Filter items by permission and role restriction
  const items = ALL_NAV_ITEMS
    .filter((item) => {
      if (restrictedKeys.includes(item.key)) {
        return isAdminOrManager && hasPermission(item.permission);
      }
      return hasPermission(item.permission);
    });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobile && !collapsed) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobile, collapsed, onClose]);

  const widthClass = isMobile ? 'w-56' : collapsed ? 'w-16' : 'w-56';
  const transformClass = isMobile
    ? collapsed
      ? '-translate-x-full'
      : 'translate-x-0'
    : 'translate-x-0';

  const roleDisplay = role?.display_name || role?.name || '';

  return (
    <>
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-13 left-0 z-40 flex flex-col h-screen bg-slate-800 dark:bg-slate-900 text-slate-200 transition-all duration-300 ease-in-out ${widthClass} ${transformClass}`}
      >
        <div className="h-4" />
        <div className="px-4 py-2 border-b border-slate-700">
          <p className="text-xs text-slate-400">
            {isMobile || !collapsed ? t('logged_in_as') : ''}
          </p>
          {(!collapsed || isMobile) && (
            <Badge tone="orange" className="mt-1">{roleDisplay}</Badge>
          )}
        </div>
        <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey);
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.key === 'overview'}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  } ${collapsed && !isMobile ? 'justify-center' : ''}`
                }
                title={collapsed && !isMobile ? label : ''}
                onClick={() => { if (isMobile) onClose(); }}
              >
                <Icon size={16} className="shrink-0" />
                {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Sidebar;