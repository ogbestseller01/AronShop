import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { companyApi } from '../../services/api';
import { Company, CompanyFormData, CompanyFilters } from '../../types';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  X,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Archive,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

// Country codes (same as UsersPage)
const COUNTRY_CODES = [
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+256', label: 'Uganda (+256)' },
];

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

const CompaniesPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<CompanyFilters>({
    per_page: 1000,
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isForceDeleteModalOpen, setIsForceDeleteModalOpen] = useState(false);
  const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>({
    company_name: '',
    address: '',
    phone: '',
    email: '',
    status: 'active',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone split state
  const [selectedPrefix, setSelectedPrefix] = useState(COUNTRY_CODES[0].code);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canView = hasPermission('companies.view');
  const canCreate = hasPermission('companies.create');
  const canEdit = hasPermission('companies.edit');
  const canDelete = hasPermission('companies.delete');
  const canRestore = hasPermission('companies.restore');

  const fetchCompanies = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await companyApi.index({ ...filters, page: currentPage });
      setCompanies(res.data.data.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch companies';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchCompanies();
    }
  }, [filters, currentPage, canView]);

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

  const getFullPhone = () => {
    if (!phoneNumber) return '';
    const cleaned = phoneNumber.replace(/^0+/, '');
    return selectedPrefix + cleaned;
  };

  const handleOpenModal = (company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      setFormData({
        company_name: company.company_name,
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        status: company.status,
      });
      // Split phone into prefix and number
      if (company.phone) {
        const matched = COUNTRY_CODES.find((c) => company.phone.startsWith(c.code));
        if (matched) {
          setSelectedPrefix(matched.code);
          setPhoneNumber(company.phone.replace(matched.code, ''));
        } else {
          setSelectedPrefix(COUNTRY_CODES[0].code);
          setPhoneNumber(company.phone);
        }
      } else {
        setSelectedPrefix(COUNTRY_CODES[0].code);
        setPhoneNumber('');
      }
    } else {
      setSelectedCompany(null);
      setFormData({ company_name: '', address: '', phone: '', email: '', status: 'active' });
      setSelectedPrefix(COUNTRY_CODES[0].code);
      setPhoneNumber('');
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCompany(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = getFullPhone();
    if (!fullPhone) {
      toast.error('Please enter a valid phone number');
      return;
    }
    const submitData = { ...formData, phone: fullPhone };
    setIsSubmitting(true);
    try {
      if (selectedCompany) {
        await companyApi.update(selectedCompany.id, submitData);
        toast.success('Company updated successfully');
      } else {
        await companyApi.store(submitData);
        toast.success('Company created successfully');
      }
      fetchCompanies();
      handleCloseModal();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;
    try {
      await companyApi.destroy(selectedCompany.id);
      toast.success('Company deleted');
      fetchCompanies();
      setIsDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete company');
    }
  };

  const handleRestore = async () => {
    if (!selectedCompany) return;
    try {
      await companyApi.restore(selectedCompany.id);
      toast.success('Company restored');
      fetchCompanies();
      setIsRestoreModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore company');
    }
  };

  const handleForceDelete = async () => {
    if (!selectedCompany) return;
    try {
      await companyApi.forceDelete(selectedCompany.id);
      toast.success('Company permanently deleted');
      fetchCompanies();
      setIsForceDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to permanently delete company');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedCompany) return;
    try {
      await companyApi.toggleStatus(selectedCompany.id);
      toast.success(`Status changed to ${selectedCompany.status === 'active' ? 'inactive' : 'active'}`);
      fetchCompanies();
      setIsToggleStatusModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const columns = [
    {
      key: 'company_name',
      label: t('company_name'),
    },
    {
      key: 'address',
      label: t('address'),
      render: (item: Company) => item.address || '—',
    },
    {
      key: 'phone',
      label: t('phone'),
      render: (item: Company) => item.phone || '—',
    },
    {
      key: 'email',
      label: t('email'),
      render: (item: Company) => item.email || '—',
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: Company) => (
        <Badge tone={getStatusBadge(item.status)}>
          {getStatusLabel(item.status, t)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Company) => (
        <div className="relative" ref={dropdownOpen === item.id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.id ? null : item.id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.id && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
              {canEdit && !item.deleted_at && (
                <button
                  onClick={() => handleOpenModal(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition"
                >
                  <Edit size={16} className="text-orange-500" />
                  {t('edit')}
                </button>
              )}
              {!item.deleted_at && (
                <button
                  onClick={() => { setSelectedCompany(item); setIsToggleStatusModalOpen(true); setDropdownOpen(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
                >
                  <RefreshCw size={16} />
                  {t('toggle_status')}
                </button>
              )}
              {item.deleted_at ? (
                <>
                  {canRestore && (
                    <button
                      onClick={() => { setSelectedCompany(item); setIsRestoreModalOpen(true); setDropdownOpen(null); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-green-600 dark:text-green-400 transition"
                    >
                      <RotateCcw size={16} />
                      {t('restore')}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => { setSelectedCompany(item); setIsForceDeleteModalOpen(true); setDropdownOpen(null); }}
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
                    onClick={() => { setSelectedCompany(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
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

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            You do not have permission to view companies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('companies')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-2 md:px-3 py-1  bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_company')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : companies}
          itemsPerPage={filters.per_page || 1000}
          onRefresh={fetchCompanies}
          showSearch={false}
        />
      </div>

      {/* ===== CREATE/EDIT MODAL ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedCompany ? t('edit_company') : t('add_company')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('company_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('address')}</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('phone')}</label>
                <div className="flex gap-2">
                  <select
                    value={selectedPrefix}
                    onChange={(e) => setSelectedPrefix(e.target.value)}
                    className="w-1/3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      val = val.replace(/^0+/, '');
                      if (val.length > 9) val = val.slice(0, 9);
                      setPhoneNumber(val);
                    }}
                    placeholder="e.g. 768798987"
                    maxLength={9}
                    className="w-2/3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('email')}</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
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
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : selectedCompany ? t('update') : t('create')}
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
        title={t('delete_company')}
        message={t('delete_company_confirm', { name: selectedCompany?.company_name || '' })}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={isSubmitting}
      />

      {/* Restore Confirmation */}
      <ConfirmDialog
        isOpen={isRestoreModalOpen}
        title={t('restore_company')}
        message={t('restore_company_confirm', { name: selectedCompany?.company_name || '' })}
        onConfirm={handleRestore}
        onCancel={() => setIsRestoreModalOpen(false)}
        isLoading={isSubmitting}
        confirmVariant="green"
      />

      {/* Force Delete Confirmation */}
      <ConfirmDialog
        isOpen={isForceDeleteModalOpen}
        title={t('force_delete_company')}
        message={t('force_delete_company_confirm', { name: selectedCompany?.company_name || '' })}
        onConfirm={handleForceDelete}
        onCancel={() => setIsForceDeleteModalOpen(false)}
        isLoading={isSubmitting}
      />

      {/* Toggle Status Confirmation */}
      <ConfirmDialog
        isOpen={isToggleStatusModalOpen}
        title={t('toggle_status')}
        message={selectedCompany?.status === 'active' ? t('deactivate_company_confirm', { name: selectedCompany?.company_name || '' }) : t('activate_company_confirm', { name: selectedCompany?.company_name || '' })}
        onConfirm={handleToggleStatus}
        onCancel={() => setIsToggleStatusModalOpen(false)}
        isLoading={isSubmitting}
        confirmVariant="blue"
      />
    </div>
  );
};

export default CompaniesPage;