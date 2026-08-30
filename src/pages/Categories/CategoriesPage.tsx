import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { categoryApi } from '../../services/api';
import { ProductCategory, ProductCategoryFormData } from '../../types';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  X,
  MoreVertical,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

const getStatusBadge = (status: string) => {
  const map: Record<string, 'green' | 'gray'> = {
    active: 'green',
    inactive: 'gray',
  };
  return map[status] || 'gray';
};

const getStatusLabel = (status: string, t: any) => {
  const map: Record<string, string> = {
    active: t('active'),
    inactive: t('inactive'),
  };
  return map[status] || status;
};

// Confirm dialog component
const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmVariant?: 'red' | 'green' | 'blue';
}> = ({ isOpen, title, message, onConfirm, onCancel, isLoading = false, confirmVariant = 'red' }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  const bgColor = confirmVariant === 'red' ? 'bg-red-600 hover:bg-red-700' : confirmVariant === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition">
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 ${bgColor} disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center gap-2`}
          >
            {isLoading && <RefreshCw size={16} className="animate-spin" />}
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoriesPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [formData, setFormData] = useState<ProductCategoryFormData>({
    category_name: '',
    model: '',
    sku: [],
    status: 'active',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // SKU input state
  const [skuInput, setSkuInput] = useState('');

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canView = hasPermission('categories.view');
  const canCreate = hasPermission('categories.create');
  const canEdit = hasPermission('categories.edit');
  const canDelete = hasPermission('categories.delete');

  const fetchCategories = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await categoryApi.index({ per_page: 1000, page: currentPage });
      setCategories(res.data.data.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch categories';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchCategories();
    }
  }, [currentPage, canView]);

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

  const handleOpenModal = (category?: ProductCategory) => {
    if (category) {
      setSelectedCategory(category);
      setFormData({
        category_name: category.category_name,
        model: category.model || '',
        sku: category.sku || [],
        status: category.status,
      });
      setSkuInput('');
    } else {
      setSelectedCategory(null);
      setFormData({ category_name: '', model: '', sku: [], status: 'active' });
      setSkuInput('');
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
  };

  const handleAddSku = () => {
    if (!skuInput.trim()) return;
    const currentSkus = formData.sku || [];
    if (currentSkus.includes(skuInput.trim())) {
      toast.error('SKU already exists');
      return;
    }
    setFormData({
      ...formData,
      sku: [...currentSkus, skuInput.trim()],
    });
    setSkuInput('');
  };

  const handleRemoveSku = (skuToRemove: string) => {
    setFormData({
      ...formData,
      sku: (formData.sku || []).filter((s) => s !== skuToRemove),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedCategory) {
        await categoryApi.update(selectedCategory.category_id, formData);
        toast.success('Category updated successfully');
      } else {
        await categoryApi.store(formData);
        toast.success('Category created successfully');
      }
      fetchCategories();
      handleCloseModal();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      await categoryApi.destroy(selectedCategory.category_id);
      toast.success('Category deleted');
      fetchCategories();
      setIsDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedCategory) return;
    try {
      await categoryApi.toggleStatus(selectedCategory.category_id);
      toast.success(`Status changed to ${selectedCategory.status === 'active' ? 'inactive' : 'active'}`);
      fetchCategories();
      setIsToggleStatusModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const columns = [
    {
      key: 'category_name',
      label: t('category_name'),
    },
    {
      key: 'model',
      label: t('model'),
      render: (item: ProductCategory) => item.model || '—',
    },
    {
      key: 'sku',
      label: t('sku'),
      render: (item: ProductCategory) => {
        const skus = item.sku || [];
        return skus.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {skus.map((s, idx) => (
              <Badge key={idx} tone="blue" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        ) : '—';
      },
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: ProductCategory) => (
        <Badge tone={getStatusBadge(item.status)}>
          {getStatusLabel(item.status, t)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: ProductCategory) => (
        <div className="relative" ref={dropdownOpen === item.category_id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.category_id ? null : item.category_id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.category_id && (
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
              <button
                onClick={() => { setSelectedCategory(item); setIsToggleStatusModalOpen(true); setDropdownOpen(null); }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
              >
                <RefreshCw size={16} />
                {t('toggle_status')}
              </button>
              {canDelete && (
                <button
                  onClick={() => { setSelectedCategory(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
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

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            You do not have permission to view categories.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('product_categories')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_category')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : categories}
          itemsPerPage={1000}
          onRefresh={fetchCategories}
          showSearch={false}
        />
      </div>

      {/* ===== CREATE/EDIT MODAL ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedCategory ? t('edit_category') : t('add_category')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('category_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('model')}</label>
                <input
                  type="text"
                  value={formData.model || ''}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('sku')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skuInput}
                    onChange={(e) => setSkuInput(e.target.value)}
                    placeholder={t('enter_sku')}
                    className="flex-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSku())}
                  />
                  <button
                    type="button"
                    onClick={handleAddSku}
                    className="px-3 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium"
                  >
                    {t('add')}
                  </button>
                </div>
                {(formData.sku || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.sku || []).map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => handleRemoveSku(s)}
                          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('status')}</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : selectedCategory ? t('update') : t('create')}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        title={t('delete_category')}
        message={t('delete_category_confirm', { name: selectedCategory?.category_name || '' })}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={isSubmitting}
      />

      {/* Toggle Status Confirmation */}
      <ConfirmDialog
        isOpen={isToggleStatusModalOpen}
        title={t('toggle_status')}
        message={selectedCategory?.status === 'active' ? t('deactivate_category_confirm', { name: selectedCategory?.category_name || '' }) : t('activate_category_confirm', { name: selectedCategory?.category_name || '' })}
        onConfirm={handleToggleStatus}
        onCancel={() => setIsToggleStatusModalOpen(false)}
        isLoading={isSubmitting}
        confirmVariant="blue"
      />
    </div>
  );
};

export default CategoriesPage;