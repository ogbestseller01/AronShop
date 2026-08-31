// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { shopApi, userApi } from '../../services/api';
import { Shop, ShopFormData, User } from '../../types';
import toast from 'react-hot-toast';
import Select from 'react-select';
import {
  Edit,
  Trash2,
  X,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Archive,
  Plus,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

const getStatusBadge = (status: string) => {
  const map: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'orange'> = {
    active: 'green',
    inactive: 'gray',
    maintenance: 'orange',
  };
  return map[status] || 'gray';
};

const getStatusLabel = (status: string, t: any) => {
  const map: Record<string, string> = {
    active: t('active'),
    inactive: t('inactive'),
    maintenance: t('maintenance'),
  };
  return map[status] || status;
};

// Custom styles for react-select
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isFocused ? '#fff' : '#fff',
    borderColor: state.isFocused ? '#f97316' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(251, 146, 60, 0.5)' : 'none',
    '&:hover': {
      borderColor: '#f97316',
    },
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#f97316' : state.isFocused ? '#ffedd5' : 'transparent',
    color: state.isSelected ? '#fff' : '#111827',
  }),
  menu: (provided: any) => ({
    ...provided,
    zIndex: 9999,
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: '#111827',
  }),
  input: (provided: any) => ({
    ...provided,
    color: '#111827',
  }),
};

const ShopsPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [managers, setManagers] = useState<User[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isForceDeleteModalOpen, setIsForceDeleteModalOpen] = useState(false);

  const [formData, setFormData] = useState<ShopFormData>({
    name: '',
    location: '',
    manager_id: '',
    status: 'active',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canCreate = hasPermission('warehouses.create');
  const canEdit = hasPermission('warehouses.edit');
  const canDelete = hasPermission('warehouses.delete');
  const canRestore = hasPermission('warehouses.restore');
  const canForceDelete = hasPermission('warehouses.force_delete');

  // Fetch managers (users) – sorted alphabetically
  const fetchManagers = async () => {
    try {
      const res = await userApi.index({ per_page: 1000 });
      const allUsers = res.data.data.data || [];
      const sorted = allUsers.sort((a: User, b: User) =>
        a.name.localeCompare(b.name)
      );
      setManagers(sorted);
    } catch (err: any) {
      toast.error('Failed to load managers');
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  // Fetch shops
  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await shopApi.index({ search, per_page: 1000 });
      setShops(res.data.data.data || [] as any);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch shops';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, [search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Handlers ----
  const handleOpenModal = (shop?: Shop) => {
    if (shop) {
      setSelectedShop(shop);
      setFormData({
        name: shop.name,
        location: shop.location || '',
        manager_id: shop.manager_id || '',
        status: shop.status,
      });
    } else {
      setSelectedShop(null);
      setFormData({ name: '', location: '', manager_id: '', status: 'active' });
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedShop(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedShop) {
        await shopApi.update(selectedShop.shop_id, formData);
        toast.success('Shop updated successfully');
      } else {
        await shopApi.store(formData);
        toast.success('Shop created successfully');
      }
      fetchShops();
      handleCloseModal();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedShop) return;
    try {
      await shopApi.destroy(selectedShop.shop_id);
      toast.success('Shop deleted');
      fetchShops();
      setIsDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete shop';
      toast.error(msg);
    }
  };

  const handleRestore = async () => {
    if (!selectedShop) return;
    try {
      await shopApi.restore(selectedShop.shop_id);
      toast.success('Shop restored');
      fetchShops();
      setIsRestoreModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to restore shop';
      toast.error(msg);
    }
  };

  const handleForceDelete = async () => {
    if (!selectedShop) return;
    try {
      await shopApi.forceDelete(selectedShop.shop_id);
      toast.success('Shop permanently deleted');
      fetchShops();
      setIsForceDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to permanently delete shop';
      toast.error(msg);
    }
  };

  const handleChangeStatus = async (status: string) => {
    if (!selectedShop) return;
    try {
      await shopApi.changeStatus(selectedShop.shop_id, status);
      toast.success(`Status changed to ${status}`);
      fetchShops();
      setIsStatusModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to change status';
      toast.error(msg);
    }
  };

  // Prepare options for react-select
  const managerOptions = managers.map((user) => ({
    value: user.id,
    label: user.name,
  }));

  const selectedManagerOption = formData.manager_id
    ? managerOptions.find((opt) => opt.value === formData.manager_id)
    : null;

  // Columns
  const columns = [
    { key: 'name', label: t('shop_name') },
    {
      key: 'location',
      label: t('location'),
      render: (item: Shop) => item.location || '—',
    },
    {
      key: 'manager',
      label: t('manager'),
      render: (item: Shop) => item.manager?.name || '—',
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: Shop) => (
        <Badge tone={getStatusBadge(item.status)}>
          {getStatusLabel(item.status, t)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Shop) => (
        <div className="relative" ref={dropdownOpen === item.shop_id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.shop_id ? null : item.shop_id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.shop_id && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 max-h-80 overflow-y-auto">
              {canEdit && (
                <button
                  onClick={() => handleOpenModal(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition"
                >
                  <Edit size={16} className="text-orange-500" />
                  {t('edit')}
                </button>
              )}
              <button
                onClick={() => { setSelectedShop(item); setIsStatusModalOpen(true); setDropdownOpen(null); }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
              >
                <RefreshCw size={16} />
                {t('change_status')}
              </button>
              {item.deleted_at ? (
                <>
                  {canRestore && (
                    <button
                      onClick={() => { setSelectedShop(item); setIsRestoreModalOpen(true); setDropdownOpen(null); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-green-600 dark:text-green-400 transition"
                    >
                      <RotateCcw size={16} />
                      {t('restore')}
                    </button>
                  )}
                  {canForceDelete && (
                    <button
                      onClick={() => { setSelectedShop(item); setIsForceDeleteModalOpen(true); setDropdownOpen(null); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                    >
                      <Archive size={16} />
                      {t('force_delete')}
                    </button>
                  )}
                </>
              ) : (
                canDelete && (
                  <button
                    onClick={() => { setSelectedShop(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                  >
                    <Trash2 size={16} />
                    {t('delete')}
                  </button>
                )
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('shops')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_shop')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : shops}
          itemsPerPage={10}
          onRefresh={fetchShops}
        />
      </div>

      {/* ===== CREATE/EDIT MODAL ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedShop ? t('edit_shop') : t('create_shop')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('shop_name')} <span className="text-red-500">*</span>
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
                  {t('location')}
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('manager')}
                </label>
                <Select
                  options={managerOptions}
                  value={selectedManagerOption}
                  onChange={(option: any) =>
                    setFormData({ ...formData, manager_id: option?.value || '' })
                  }
                  isClearable
                  placeholder={t('select_manager')}
                  styles={customSelectStyles}
                  className="w-full"
                  classNamePrefix="react-select"
                  theme={(theme) => ({
                    ...theme,
                    colors: {
                      ...theme.colors,
                      primary: '#f97316',
                      primary25: '#ffedd5',
                      primary50: '#fed7aa',
                    },
                  })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('status')}
                </label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                  <option value="maintenance">{t('maintenance')}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {selectedShop ? t('updating') : t('creating')}
                    </>
                  ) : (
                    selectedShop ? t('update') : t('create')
                  )}
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

      {/* ===== DELETE CONFIRMATION ===== */}
      {isDeleteModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('delete_shop')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('delete_shop_confirm', { name: selectedShop.name })}
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

      {/* ===== RESTORE CONFIRMATION ===== */}
      {isRestoreModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('restore_shop')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('restore_shop_confirm', { name: selectedShop.name })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRestore}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                {t('restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FORCE DELETE CONFIRMATION ===== */}
      {isForceDeleteModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('force_delete_shop')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('force_delete_shop_confirm', { name: selectedShop.name })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsForceDeleteModalOpen(false)}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleForceDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium"
              >
                {t('force_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CHANGE STATUS MODAL ===== */}
      {isStatusModalOpen && selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('change_status')} – {selectedShop.name}
            </h3>
            <div className="space-y-2">
              {['active', 'inactive', 'maintenance'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleChangeStatus(status)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition ${
                    selectedShop.status === status
                      ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800'
                      : ''
                  }`}
                >
                  {t(status)}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopsPage;