import React, { useState, useEffect, useMemo } from 'react';
import { roleApi, permissionApi } from '../../services/api';
import { Role, Permission } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';
import { X, Check, RefreshCw, ChevronDown, ChevronRight, Layers } from 'lucide-react';

interface Props {
  role: Role;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper to extract module name from permission name (e.g., "users.view" → "Users")
const getModuleName = (permissionName: string): string => {
  const parts = permissionName.split('.');
  if (parts.length < 2) return 'Other';
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
};

// Get a user-friendly action name (e.g., "users.view" → "View")
const getActionName = (permissionName: string): string => {
  const parts = permissionName.split('.');
  return parts.length > 1 ? parts.slice(1).join(' ') : permissionName;
};

// Get a nice icon for each module
const getModuleIcon = (module: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    Users: <Users size={16} className="text-blue-500" />,
    Roles: <Key size={16} className="text-purple-500" />,
    Reports: <BarChart3 size={16} className="text-green-500" />,
    Products: <Package size={16} className="text-orange-500" />,
    Suppliers: <Store size={16} className="text-teal-500" />,
    Customers: <Users size={16} className="text-cyan-500" />,
    Orders: <ClipboardList size={16} className="text-indigo-500" />,
    Inventory: <Warehouse size={16} className="text-amber-500" />,
    Permissions: <Shield size={16} className="text-red-500" />,
    Dashboard: <Layout size={16} className="text-gray-500" />,
    Audit: <FileText size={16} className="text-slate-500" />,
    OTP: <KeyRound size={16} className="text-pink-500" />,
    Categories: <Tag size={16} className="text-lime-500" />,
    Warehouses: <Building2 size={16} className="text-sky-500" />,
  };
  return icons[module] || <Layers size={16} className="text-gray-400" />;
};

// Import all needed Lucide icons
import {
  Users,
  Key,
  BarChart3,
  Package,
  Store,
  ClipboardList,
  Warehouse,
  Shield,
  Layout,
  FileText,
  KeyRound,
  Tag,
  Building2,
} from 'lucide-react';

const RolePermissionsModal: React.FC<Props> = ({ role, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [permsRes, rolePermsRes] = await Promise.all([
          permissionApi.index({ per_page: 1000 }),
          roleApi.getPermissions(role.id),
        ]);
        setAllPermissions(permsRes.data.data.data || []);
        const assigned = rolePermsRes.data.data || [];
        setAssignedIds(assigned.map((p: Permission) => p.id));
      } catch (err: any) {
        toast.error(err.message || 'Failed to load permissions');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [role.id]);

  // Group by module, sort alphabetically
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    allPermissions.forEach((perm) => {
      const module = getModuleName(perm.name);
      if (!groups[module]) groups[module] = [];
      groups[module].push(perm);
    });
    const sortedGroups: Record<string, Permission[]> = {};
    Object.keys(groups)
      .sort()
      .forEach((key) => {
        sortedGroups[key] = groups[key].sort((a, b) => a.name.localeCompare(b.name));
      });
    return sortedGroups;
  }, [allPermissions]);

  // Expand all groups by default
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    Object.keys(groupedPermissions).forEach((module) => {
      initialExpanded[module] = true;
    });
    setExpandedGroups(initialExpanded);
  }, [groupedPermissions]);

  const toggleGroup = (module: string) => {
    setExpandedGroups((prev) => ({ ...prev, [module]: !prev[module] }));
  };

  const togglePermission = (permId: string) => {
    setAssignedIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const toggleAllInGroup = (module: string, checked: boolean) => {
    const permIds = groupedPermissions[module].map((p) => p.id);
    if (checked) {
      setAssignedIds((prev) => [...new Set([...prev, ...permIds])]);
    } else {
      setAssignedIds((prev) => prev.filter((id) => !permIds.includes(id)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await roleApi.syncPermissions(role.id, assignedIds);
      toast.success('Permissions updated successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const isAllCheckedInGroup = (module: string) => {
    const permIds = groupedPermissions[module].map((p) => p.id);
    return permIds.every((id) => assignedIds.includes(id));
  };

  const isSomeCheckedInGroup = (module: string) => {
    const permIds = groupedPermissions[module].map((p) => p.id);
    return permIds.some((id) => assignedIds.includes(id)) && !isAllCheckedInGroup(module);
  };

  // Count total selected
  const totalSelected = assignedIds.length;
  const totalPermissions = allPermissions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200/50 dark:border-slate-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Shield size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {role.display_name || role.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('permissions')} • {totalSelected} / {totalPermissions} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-gray-500 dark:text-gray-400">
            <RefreshCw size={24} className="animate-spin mr-2" />
            {t('loading')}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {Object.entries(groupedPermissions).map(([module, perms]) => {
                const isExpanded = expandedGroups[module] ?? true;
                const allChecked = isAllCheckedInGroup(module);
                const someChecked = isSomeCheckedInGroup(module);

                return (
                  <div
                    key={module}
                    className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition"
                  >
                    {/* Group header */}
                    <div
                      className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 dark:bg-slate-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/80 transition"
                      onClick={() => toggleGroup(module)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 dark:text-gray-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {getModuleIcon(module)}
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {module}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">
                          {perms.length}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInGroup(module, !allChecked);
                        }}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                          allChecked
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : someChecked
                            ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200 hover:bg-orange-300 dark:hover:bg-orange-700'
                            : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                        }`}
                      >
                        {allChecked ? t('deselect_all') : t('select_all')}
                      </button>
                    </div>

                    {/* Group content */}
                    {isExpanded && (
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-1 bg-white dark:bg-slate-800/50">
                        {perms.map((perm) => {
                          const isChecked = assignedIds.includes(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition ${
                                isChecked
                                  ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                                  : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.id)}
                                className="w-4 h-4 text-orange-500 focus:ring-orange-400 rounded border-gray-300 dark:border-slate-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {perm.display_name || getActionName(perm.name)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50/50 dark:bg-slate-800/50 rounded-b-2xl">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-sm"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                {t('save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RolePermissionsModal;