// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { permissionApi } from '../../services/api';
import { Permission, PermissionFormData } from '../../types';
import toast from 'react-hot-toast';
import { Edit, Trash2, X, MoreVertical  , Plus} from 'lucide-react';;
import DataTable from '../../components/DataTable';

const PermissionsPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<PermissionFormData>({ name: '', display_name: '', description: '' });

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

  const canCreate = hasPermission('permissions.create');
  const canEdit = hasPermission('permissions.edit');
  const canDelete = hasPermission('permissions.delete');

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await permissionApi.index({ search, per_page: 1000 });
      setPermissions(res.data.data.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [search]);

  const handleOpenModal = (perm?: Permission) => {
    if (perm) {
      setSelectedPermission(perm);
      setFormData({
        name: perm.name,
        display_name: perm.display_name,
        description: perm.description || '',
      });
    } else {
      setSelectedPermission(null);
      setFormData({ name: '', display_name: '', description: '' });
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPermission(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedPermission) {
        await permissionApi.update(selectedPermission.id, formData);
        toast.success('Permission updated successfully');
      } else {
        await permissionApi.store(formData);
        toast.success('Permission created successfully');
      }
      fetchPermissions();
      handleCloseModal();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!selectedPermission) return;
    try {
      await permissionApi.destroy(selectedPermission.id);
      toast.success('Permission deleted successfully');
      fetchPermissions();
      setIsDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete permission');
    }
  };

  const columns = [
    {
      key: 'name',
      label: t('permission_name'),
      render: (item: Permission) => <span className="font-mono text-sm">{item.name}</span>,
    },
    {
      key: 'display_name',
      label: t('display_name'),
    },
    {
      key: 'description',
      label: t('description'),
      render: (item: Permission) => item.description || '—',
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Permission) => (
        <div className="relative" ref={dropdownOpen === item.id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.id ? null : item.id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.id && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
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
                  onClick={() => { setSelectedPermission(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('permissions')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_permission')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : permissions}
          itemsPerPage={10}
          onRefresh={fetchPermissions}
        />
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedPermission ? t('edit_permission') : t('create_permission')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('permission_name')} <span className="text-red-500">*</span>
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
                  {selectedPermission ? t('update') : t('create')}
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
      {isDeleteModalOpen && selectedPermission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('delete_permission')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('delete_permission_confirm', { name: selectedPermission.display_name || selectedPermission.name })}
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
    </div>
  );
};

export default PermissionsPage;