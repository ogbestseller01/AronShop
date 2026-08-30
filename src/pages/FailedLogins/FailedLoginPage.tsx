import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { failedLoginApi } from '../../services/api';
import { FailedLoginAttempt, FailedLoginFilters, FailedLoginStats } from '../../types';
import toast from 'react-hot-toast';
import {
  RefreshCw,
  Trash2,
  Shield,
  ShieldOff,
  MoreVertical,
  X,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

// Confirm dialog component (reusable)
const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}> = ({ isOpen, title, message, onConfirm, onCancel, isLoading = false }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
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
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            {isLoading && <RefreshCw size={16} className="animate-spin" />}
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

const FailedLoginPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<FailedLoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FailedLoginStats | null>(null);

  const [filters, setFilters] = useState<FailedLoginFilters>({
    start_date: '',
    end_date: '',
    per_page: 1000,
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog state (supports block, unblock, clear)
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'block' | 'unblock' | 'clear' | null;
    ip?: string;
  }>({
    isOpen: false,
    type: null,
  });

  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const canView = hasPermission('failed_logins.view');
  const canClear = hasPermission('failed_logins.clear');
  const canBlock = hasPermission('failed_logins.block');
  const canUnblock = hasPermission('failed_logins.unblock');

  const fetchLogs = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await failedLoginApi.index({ ...filters, page: currentPage });
      setLogs(res.data.data.data.data || []);
      setStats(res.data.data.stats);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch failed login attempts';
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

  const handleFilterChange = (key: keyof FailedLoginFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Clear all – called after confirmation
  const performClearAll = async () => {
    if (!canClear) return;
    setIsClearing(true);
    try {
      const res = await failedLoginApi.clear({});
      toast.success(res.data.message || 'Cleared successfully');
      await fetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear');
    } finally {
      setIsClearing(false);
      setDialog({ isOpen: false, type: null });
      setDropdownOpen(null);
    }
  };

  const handleClearAllClick = () => {
    setDialog({ isOpen: true, type: 'clear' });
  };

  const handleBlock = async (ip: string) => {
    if (!canBlock) return;
    try {
      const res = await failedLoginApi.block(ip);
      toast.success(res.data.message || `IP ${ip} blocked successfully`);
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to block IP');
    } finally {
      setDialog({ isOpen: false, type: null });
      setDropdownOpen(null);
    }
  };

  const handleUnblock = async (ip: string) => {
    if (!canUnblock) return;
    try {
      const res = await failedLoginApi.unblock(ip);
      toast.success(res.data.message || `IP ${ip} unblocked successfully`);
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unblock IP');
    } finally {
      setDialog({ isOpen: false, type: null });
      setDropdownOpen(null);
    }
  };

  const openDialog = (type: 'block' | 'unblock', ip: string) => {
    setDialog({ isOpen: true, type, ip });
    setDropdownOpen(null);
  };

  const closeDialog = () => setDialog({ isOpen: false, type: null });

  const handleDialogConfirm = () => {
    const { type, ip } = dialog;
    if (type === 'block' && ip) handleBlock(ip);
    else if (type === 'unblock' && ip) handleUnblock(ip);
    else if (type === 'clear') performClearAll();
  };

  // Table columns
  const columns = [
    {
      key: 'email',
      label: t('email'),
      render: (item: FailedLoginAttempt) => <span className="text-xs md:text-sm">{item.email}</span>,
    },
    {
      key: 'ip_address',
      label: t('ip_address'),
      render: (item: FailedLoginAttempt) => <span className="font-mono text-xs md:text-sm">{item.ip_address}</span>,
    },
    {
      key: 'attempt_count',
      label: t('attempts'),
      render: (item: FailedLoginAttempt) => {
        const isBlocked = item.attempt_count >= 5;
        return (
          <span className={`font-medium ${isBlocked ? 'text-red-600' : 'text-gray-700'}`}>
            {item.attempt_count} {isBlocked && <Badge tone="red" className="ml-1">{t('blocked')}</Badge>}
          </span>
        );
      },
    },
    {
      key: 'last_attempt_at',
      label: t('last_attempt'),
      render: (item: FailedLoginAttempt) => new Date(item.last_attempt_at).toLocaleString(),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: FailedLoginAttempt) => (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.id ? null : item.id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.id && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
              {canBlock && item.attempt_count < 5 && (
                <button
                  onClick={() => openDialog('block', item.ip_address)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                >
                  <Shield size={16} />
                  {t('block_ip')}
                </button>
              )}
              {canUnblock && item.attempt_count >= 5 && (
                <button
                  onClick={() => openDialog('unblock', item.ip_address)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-green-600 dark:text-green-400 transition"
                >
                  <ShieldOff size={16} />
                  {t('unblock_ip')}
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
            You do not have permission to view failed login attempts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1 md:p-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-0.5 md:mb-3 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-0.5 md:py-1">
        <h1 className="text-sm md:text-xl font-bold text-gray-900 dark:text-white">{t('failed_logins')}</h1>
        {canClear && (
          <button
            onClick={handleClearAllClick}
            className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-7 py-1  bg-red-600 hover:bg-red-700 text-white rounded text-[8px] md:text-xs font-medium transition"
          >
            <Trash2 size={10} className="md:w-3 md:h-3" /> {t('clear_all')}
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0.5 md:gap-2 mb-0.5 md:mb-3">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('total_records')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.total_records}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('unique_emails')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.unique_emails}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('unique_ips')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.unique_ips}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5"><Shield size={8} className="md:w-4 md:h-4 text-red-500" /> {t('blocked_ips')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.blocked_ips}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('today_attempts')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.today_attempts}</span>
          </div>
        </div>
      )}

      {/* Date filters */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-0.5 md:p-3 mb-0.5 md:mb-3">
        <div className="grid grid-cols-2 gap-0.5 md:gap-2 md:w-1/2">
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={dialog.isOpen}
        title={
          dialog.type === 'block'
            ? t('block_ip')
            : dialog.type === 'unblock'
            ? t('unblock_ip')
            : t('clear_all')
        }
        message={
          dialog.type === 'block'
            ? `${t('block_ip_confirm')} ${dialog.ip || ''}`
            : dialog.type === 'unblock'
            ? `${t('unblock_ip_confirm')} ${dialog.ip || ''}`
            : t('clear_all_confirm')
        }
        onConfirm={handleDialogConfirm}
        onCancel={closeDialog}
        isLoading={isClearing}
      />
    </div>
  );
};

export default FailedLoginPage;