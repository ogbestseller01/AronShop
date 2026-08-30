// src/components/Sidebar.tsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  Package,
  BarChart3,
  ClipboardList,
  Key,
  Warehouse,
  FileText,
  KeyRound,
  ShieldAlert,
  Building2,
  Tag,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Badge from './Badge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  collapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
}

// 🔐 Main navigation items
const MAIN_NAV_ITEMS = [
  { key: 'overview', labelKey: 'dashboard', icon: Home, permission: 'dashboard.main.view', path: '/' },
  { key: 'shops', labelKey: 'shops', icon: Warehouse, permission: 'warehouses.view', path: '/shops' },
  { key: 'products', labelKey: 'products', icon: Package, permission: 'products.view', path: '/products' },
  { key: 'sales', labelKey: 'sales', icon: ClipboardList, permission: 'sales.view', path: '/sales' },
  { key: 'analysis', labelKey: 'analysis', icon: BarChart3, permission: 'reports.sales.view', path: '/analysis' },
  { key: 'reports', labelKey: 'reports', icon: BarChart3, permission: 'reports.view', path: '/reports' },
  { key: 'companies', labelKey: 'companies', icon: Building2, permission: 'companies.view', path: '/companies' },
  { key: 'categories', labelKey: 'product_categories', icon: Tag, permission: 'categories.view', path: '/categories' },
];

// ⚙️ Settings sub-menu items
const SETTINGS_ITEMS = [
  { key: 'users', labelKey: 'users', icon: Users, permission: 'users.view', path: '/users' },
  { key: 'roles', labelKey: 'roles', icon: Users, permission: 'roles.view', path: '/roles' },
  { key: 'permissions', labelKey: 'permissions', icon: Key, permission: 'permissions.view', path: '/permissions' },
  { key: 'otp', labelKey: 'otp_management', icon: KeyRound, permission: 'otp.view', path: '/otp' },
  { key: 'failed_logins', labelKey: 'failed_logins', icon: ShieldAlert, permission: 'failed_logins.view', path: '/failed-logins' },
  { key: 'audit', labelKey: 'audit_trail', icon: FileText, permission: 'audit.view', path: '/audit' },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, isMobile, onClose }) => {
  const { t } = useLanguage();
  const { role, hasPermission } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(true);

  // 🔒 Only ADMINISTRATOR and MANAGER can see settings items
  const isAdminOrManager = role?.name === 'ADMINISTRATOR' || role?.name === 'MANAGER';

  // Filter main items by permission
  const mainItems = MAIN_NAV_ITEMS.filter((item) => hasPermission(item.permission));

  // Filter settings items by permission and role
  const settingsItems = SETTINGS_ITEMS.filter((item) => 
    isAdminOrManager && hasPermission(item.permission)
  );

  const hasSettings = settingsItems.length > 0;

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

  // Toggle settings when clicking the header
  const toggleSettings = () => {
    if (!collapsed || isMobile) {
      setSettingsOpen(!settingsOpen);
    }
  };

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
          {/* Main Navigation Items */}
          {mainItems.map((item) => {
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

          {/* Settings Section - Only show if there are settings items */}
          {hasSettings && (
            <div className="mt-2">
              {/* Settings Header */}
              <button
                onClick={toggleSettings}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors ${
                  collapsed && !isMobile ? 'justify-center' : ''
                }`}
                title={collapsed && !isMobile ? t('settings') : ''}
              >
                <Settings size={16} className="shrink-0" />
                {(!collapsed || isMobile) && (
                  <>
                    <span className="flex-1 text-left truncate">{t('settings')}</span>
                    {settingsOpen ? (
                      <ChevronDown size={14} className="shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0" />
                    )}
                  </>
                )}
              </button>

              {/* Settings Sub-menu Items */}
              {(settingsOpen || (collapsed && !isMobile)) && (
                <div className={`space-y-1 ${!collapsed || isMobile ? 'ml-4 pl-2 border-l border-slate-700' : ''}`}>
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    const label = t(item.labelKey);
                    
                    return (
                      <NavLink
                        key={item.key}
                        to={item.path}
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
                        <Icon size={14} className="shrink-0" />
                        {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;