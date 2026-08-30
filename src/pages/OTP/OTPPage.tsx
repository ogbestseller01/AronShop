import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { otpApi } from '../../services/api';
import { OTP, OTPFilters, OTPStats } from '../../types';
import toast from 'react-hot-toast';
import Select from 'react-select';
import {
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

// Custom styles for react-select – compact on mobile
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isFocused ? '#fff' : '#fff',
    borderColor: state.isFocused ? '#f97316' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(251, 146, 60, 0.5)' : 'none',
    '&:hover': { borderColor: '#f97316' },
    minHeight: '24px',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#f97316' : state.isFocused ? '#ffedd5' : 'transparent',
    color: state.isSelected ? '#fff' : '#111827',
  }),
  menu: (provided: any) => ({ ...provided, zIndex: 9999 }),
  singleValue: (provided: any) => ({ ...provided, color: '#111827', fontSize: '10px' }),
  input: (provided: any) => ({ ...provided, color: '#111827', fontSize: '10px' }),
  placeholder: (provided: any) => ({ ...provided, color: '#6b7280', fontSize: '10px' }),
  valueContainer: (provided: any) => ({ ...provided, padding: '0 4px' }),
  indicatorsContainer: (provided: any) => ({ ...provided, height: '22px' }),
};

const OTPPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<OTP[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OTPStats | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [isCleanupLoading, setIsCleanupLoading] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'expired' | 'used' | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
  });

  const [filters, setFilters] = useState<OTPFilters>({
    type: '',
    is_used: undefined,
    start_date: '',
    end_date: '',
    expired: false,
    per_page: 1000,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const canView = hasPermission('otp.view');
  const canCleanup = hasPermission('otp.cleanup');

  const fetchLogs = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await otpApi.index({ ...filters, page: currentPage });
      setLogs(res.data.data.data.data || []);
      setStats(res.data.data.stats);
      const uniqueTypes = (res.data.data.stats?.by_type || []).map((item) => item.type);
      setTypes(uniqueTypes);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch OTP records';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchLogs();
    }
  }, [filters, currentPage, canView]);

  const handleFilterChange = (key: keyof OTPFilters, value: string | boolean | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleTypeSelect = (option: any) => {
    setFilters((prev) => ({ ...prev, type: option?.value || '' }));
    setCurrentPage(1);
  };

  const handleStatusSelect = (option: any) => {
    const val = option?.value;
    if (val === 'expired') {
      setFilters((prev) => ({ ...prev, is_used: undefined, expired: true }));
    } else if (val === 'used') {
      setFilters((prev) => ({ ...prev, is_used: true, expired: false }));
    } else if (val === 'unused') {
      setFilters((prev) => ({ ...prev, is_used: false, expired: false }));
    } else {
      setFilters((prev) => ({ ...prev, is_used: undefined, expired: false }));
    }
    setCurrentPage(1);
  };

  // Open confirmation dialog
  const openConfirmDialog = (type: 'expired' | 'used') => {
    const title = type === 'expired' ? t('cleanup_expired') : t('cleanup_used');
    const message = type === 'expired' ? t('cleanup_expired_confirm') : t('cleanup_used_confirm');
    setConfirmDialog({ isOpen: true, type, title, message });
  };

  // Close dialog
  const closeConfirmDialog = () => {
    setConfirmDialog({ isOpen: false, type: null, title: '', message: '' });
  };

  // Execute cleanup
  const executeCleanup = async () => {
    const { type } = confirmDialog;
    if (!type) return;
    setIsCleanupLoading(true);
    try {
      const res = type === 'expired' ? await otpApi.cleanup() : await otpApi.cleanupUsed();
      toast.success(res.data.message || 'Cleanup completed');
      fetchLogs();
      closeConfirmDialog();
    } catch (err: any) {
      toast.error(err.message || 'Cleanup failed');
    } finally {
      setIsCleanupLoading(false);
    }
  };

  const typeOptions = types.map((t) => ({ value: t, label: t }));
  const statusOptions = [
    { value: '', label: t('all_status') },
    { value: 'used', label: t('used') },
    { value: 'unused', label: t('unused') },
    { value: 'expired', label: t('expired') },
  ];

  const selectedStatus = (() => {
    if (filters.expired) return statusOptions.find((o) => o.value === 'expired');
    if (filters.is_used === true) return statusOptions.find((o) => o.value === 'used');
    if (filters.is_used === false) return statusOptions.find((o) => o.value === 'unused');
    return statusOptions.find((o) => o.value === '');
  })();

  const columns = [
    {
      key: 'email',
      label: t('email'),
      render: (item: OTP) => <span className="text-xs md:text-sm">{item.email}</span>,
    },
    {
      key: 'otp',
      label: t('otp_code'),
      render: (item: OTP) => <span className="font-mono text-xs md:text-sm font-bold">{item.otp}</span>,
    },
    {
      key: 'type',
      label: t('type'),
      render: (item: OTP) => <Badge tone="blue" className="text-[10px] md:text-xs">{item.type}</Badge>,
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: OTP) => {
        if (item.is_used) return <Badge tone="green" className="text-[10px] md:text-xs">{t('used')}</Badge>;
        if (new Date(item.expires_at) < new Date()) return <Badge tone="red" className="text-[10px] md:text-xs">{t('expired')}</Badge>;
        return <Badge tone="yellow" className="text-[10px] md:text-xs">{t('unused')}</Badge>;
      },
    },
    {
      key: 'expires_at',
      label: t('expires_at'),
      render: (item: OTP) => <span className="text-[10px] md:text-xs">{new Date(item.expires_at).toLocaleString()}</span>,
    },
    {
      key: 'created_at',
      label: t('created_at'),
      render: (item: OTP) => <span className="text-[10px] md:text-xs">{new Date(item.created_at).toLocaleString()}</span>,
    },
  ];

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            You do not have permission to view OTP records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1 md:p-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-0.5 md:mb-3 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-0.5 md:py-1">
        <h1 className="text-sm md:text-xl font-bold text-gray-900 dark:text-white">{t('otp_management')}</h1>
        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          {canCleanup && (
            <>
              <button
                onClick={() => openConfirmDialog('expired')}
                disabled={isCleanupLoading}
                className="inline-flex items-center gap-1 md:gap-1.5 px-1 md:px-2 py-0.5  bg-yellow-600 hover:bg-yellow-700 text-white rounded text-[10px] md:text-sm font-medium transition disabled:opacity-50"
              >
                <Trash2 size={14} className="md:w-5 md:h-5" /> {t('cleanup_expired')}
              </button>
              <button
                onClick={() => openConfirmDialog('used')}
                disabled={isCleanupLoading}
                className="inline-flex items-center gap-1 md:gap-1.5 px-1 md:px-2 py-0.5  bg-red-600 hover:bg-red-700 text-white rounded text-[10px] md:text-sm font-medium transition disabled:opacity-50"
              >
                <Trash2 size={14} className="md:w-5 md:h-5" /> {t('cleanup_used')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats – compact */}
      {stats && (
        <div className="grid grid-cols-4 gap-0.5 md:gap-2 mb-0.5 md:mb-3">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('total')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.total}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5"><CheckCircle size={8} className="md:w-4 md:h-4 text-green-500" /> {t('used')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.used}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5"><Clock size={8} className="md:w-4 md:h-4 text-yellow-500" /> {t('unused')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.unused}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5"><AlertCircle size={8} className="md:w-4 md:h-4 text-red-500" /> {t('expired')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.expired}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-0.5 md:p-3 mb-0.5 md:mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5 md:gap-2">
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('type')}</label>
            <Select
              options={typeOptions}
              value={typeOptions.find((opt) => opt.value === filters.type) || null}
              onChange={handleTypeSelect}
              isClearable
              placeholder={t('all_types')}
              styles={customSelectStyles}
              className="w-full"
              classNamePrefix="react-select"
            />
          </div>
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('status')}</label>
            <Select
              options={statusOptions}
              value={selectedStatus}
              onChange={handleStatusSelect}
              styles={customSelectStyles}
              className="w-full"
              classNamePrefix="react-select"
            />
          </div>
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('from_date')}</label>
            <input
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-0.5 md:px-2 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('to_date')}</label>
            <input
              type="date"
              value={filters.end_date || ''}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-0.5 md:px-2 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : logs}
          itemsPerPage={filters.per_page || 1000}
          onRefresh={fetchLogs}
          showSearch={false}
        />
      </div>

      {/* ===== CONFIRMATION DIALOG ===== */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {confirmDialog.title}
              </h3>
              <button
                onClick={closeConfirmDialog}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={executeCleanup}
                disabled={isCleanupLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                {isCleanupLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  t('confirm')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OTPPage;