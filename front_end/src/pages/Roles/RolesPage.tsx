import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { roleApi } from '../../services/api';
import { Role, RoleFormData } from '../../types';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Key, X, MoreVertical } from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import RolePermissionsModal from './RolePermissionsModal';

const RolesPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [formData, setFormData] = useState<RoleFormData>({ name: '', display_name: '', description: '' });

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canCreate = hasPermission('roles.create');
  const canEdit = hasPermission('roles.edit');
  const canDelete = hasPermission('roles.delete');
  const canAssignPermissions = hasPermission('roles.assign_permissions');

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await roleApi.index({ search, per_page: 1000 });
      setRoles(res.data.data.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [search]);

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setSelectedRole(role);
      setFormData({
        name: role.name,
        display_name: role.display_name,
        description: role.description || '',
      });
    } else {
      setSelectedRole(null);
      setFormData({ name: '', display_name: '', description: '' });
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRole(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedRole) {
        await roleApi.update(selectedRole.id, formData);
        toast.success('Role updated successfully');
      } else {
        await roleApi.store(formData);
        toast.success('Role created successfully');
      }
      fetchRoles();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    try {
      await roleApi.destroy(selectedRole.id);
      toast.success('Role deleted successfully');
      fetchRoles();
      setIsDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete role');
    }
  };

  const handleAssignPermissions = (role: Role) => {
    setSelectedRole(role);
    setIsPermissionModalOpen(true);
    setDropdownOpen(null);
  };

  const columns = [
    {
      key: 'name',
      label: t('role_name'),
      render: (item: Role) => <span className="font-mono text-sm">{item.name}</span>,
    },
    {
      key: 'display_name',
      label: t('display_name'),
    },
    {
      key: 'description',
      label: t('description'),
      render: (item: Role) => item.description || '—',
    },
    {
      key: 'users_count',
      label: t('users_count'),
      render: (item: Role) => <Badge tone="blue">{item.users_count ?? 0}</Badge>,
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Role) => (
        <div className="relative" ref={dropdownOpen === item.id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.id ? null : item.id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.id && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
              {canAssignPermissions && (
                <button
                  onClick={() => handleAssignPermissions(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition"
                >
                  <Key size={16} className="text-blue-500" />
                  {t('manage_permissions')}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => handleOpenModal(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition"
                >
                  <Edit size={16} className="text-orange-500" />
                  {t('edit')}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { setSelectedRole(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                >
                  <Trash2 size={16} />
                  {t('delete')}
                </button>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('roles')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_role')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : roles}
          itemsPerPage={10}
          onRefresh={fetchRoles}
        />
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedRole ? t('edit_role') : t('create_role')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('role_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('display_name')}
                </label>
                <input
                  type="text"
                  value={formData.display_name || ''}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('description')}
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-medium"
                >
                  {selectedRole ? t('update') : t('create')}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('delete_role')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('delete_role_confirm', { name: selectedRole.display_name || selectedRole.name })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {isPermissionModalOpen && selectedRole && (
        <RolePermissionsModal
          role={selectedRole}
          onClose={() => { setIsPermissionModalOpen(false); setSelectedRole(null); }}
          onSuccess={() => fetchRoles()}
        />
      )}
    </div>
  );
};

export default RolesPage;