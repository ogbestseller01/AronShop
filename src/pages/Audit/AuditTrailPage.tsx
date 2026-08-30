import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { auditApi } from '../../services/api';
import { AuditTrail, AuditTrailFilters, AuditTrailStats } from '../../types';
import toast from 'react-hot-toast';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import {
  FileText,
  FileSpreadsheet,
  FileDown,
  Search,
  X,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

// Custom styles for react-select – compact
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

const AuditTrailPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AuditTrailStats | null>(null);
  const [actions, setActions] = useState<string[]>([]);

  const [filters, setFilters] = useState<AuditTrailFilters>({
    from_date: '',
    to_date: '',
    action: '',
    search: '',
    per_page: 1000,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const canView = hasPermission('audit.view');
  const canExport = hasPermission('audit.export');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch }));
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchLogs = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await auditApi.index({ ...filters, page: currentPage });
      setLogs(res.data.data.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch audit logs';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    if (!canView) return;
    try {
      const [statsRes, actionsRes] = await Promise.all([
        auditApi.getStats({
          from_date: filters.from_date,
          to_date: filters.to_date,
          action: filters.action,
          search: filters.search,
        }),
        auditApi.getActions(),
      ]);
      setStats(statsRes.data.data);
      setActions(actionsRes.data.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load metadata');
    }
  };

  useEffect(() => {
    if (canView) {
      fetchLogs();
      fetchMetadata();
    }
  }, [filters, currentPage, canView]);

  const handleFilterChange = (key: keyof AuditTrailFilters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleActionSelect = (option: any) => {
    setFilters((prev) => ({ ...prev, action: option?.value || '' }));
    setCurrentPage(1);
  };

  // ---- Export Handlers (with toast messages) ----
  const handleExportCSV = () => {
    if (!canExport) {
      toast.error('You do not have permission to export');
      return;
    }
    toast.promise(
      (async () => {
        const response = await auditApi.exportCsv(filters);
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trails_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })(),
      {
        loading: 'Generating CSV...',
        success: 'CSV exported successfully!',
        error: (err) => err.message || 'Failed to export CSV',
      }
    );
  };

  const handleExportPDF = () => {
    if (!canExport) {
      toast.error('You do not have permission to export');
      return;
    }
    toast.promise(
      (async () => {
        const response = await auditApi.exportPdf(filters);
        const blob = new Blob([response.data], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trails_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })(),
      {
        loading: 'Generating PDF report...',
        success: 'PDF report exported successfully!',
        error: (err) => err.message || 'Failed to export PDF',
      }
    );
  };

  const handleExportExcel = () => {
    if (!canExport) {
      toast.error('You do not have permission to export');
      return;
    }
    if (logs.length === 0) {
      toast.error('No data to export');
      return;
    }
    toast.promise(
      (async () => {
        // Prepare data for Excel
        const data = logs.map((item) => ({
          'Date & Time': new Date(item.created_at).toLocaleString(),
          'User Name': item.user_name || '—',
          'User Email': item.user_email || '—',
          'Action': item.action || '—',
          'Description': item.description || '—',
          'IP Address': item.ip_address || '—',
          'Module': item.module || '—',
          'Request Method': item.request_method || '—',
          'Request URL': item.request_url || '—',
          'Response Status': item.response_status ?? '—',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Audit Trails');

        // Auto column widths
        const colWidths = Object.keys(data[0]).map(() => ({ wch: 20 }));
        ws['!cols'] = colWidths;

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trails_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })(),
      {
        loading: 'Generating Excel file...',
        success: 'Excel exported successfully!',
        error: (err) => err.message || 'Failed to export Excel',
      }
    );
  };

  const actionOptions = actions.map((act) => ({ value: act, label: act }));

  const columns = [
    {
      key: 'created_at',
      label: t('date_time'),
      render: (item: AuditTrail) => new Date(item.created_at).toLocaleString(),
    },
    {
      key: 'user',
      label: t('user'),
      render: (item: AuditTrail) => (
        <div>
          <div className="font-medium">{item.user_name || '—'}</div>
          <div className="text-[8px] md:text-xs text-gray-500">{item.user_email || '—'}</div>
        </div>
      ),
    },
    {
      key: 'action',
      label: t('action'),
      render: (item: AuditTrail) => (
        <Badge tone="blue" className="text-[10px] md:text-xs">{item.action || '—'}</Badge>
      ),
    },
    {
      key: 'description',
      label: t('description'),
      render: (item: AuditTrail) => <span className="text-[10px] md:text-xs">{item.description || '—'}</span>,
    },
    {
      key: 'ip_address',
      label: t('ip_address'),
      render: (item: AuditTrail) => <span className="text-[10px] md:text-xs">{item.ip_address || '—'}</span>,
    },
  ];

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            You do not have permission to view audit trails.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1 md:p-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-0.5 md:mb-3 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-0.5 md:py-1">
        <h1 className="text-sm md:text-xl font-bold text-gray-900 dark:text-white">{t('audit_trail')}</h1>
        <div className="flex items-center gap-0.5 md:gap-1 flex-wrap">
          {canExport && (
            <>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[8px] md:text-xs font-medium transition"
              >
                <FileText size={10} className="md:w-3.5 md:h-3.5" /> CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[8px] md:text-xs font-medium transition"
              >
                <FileSpreadsheet size={10} className="md:w-3.5 md:h-3.5" /> Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[8px] md:text-xs font-medium transition"
              >
                <FileDown size={10} className="md:w-3.5 md:h-3.5" /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-0.5 md:gap-2 mb-0.5 md:mb-3">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('total_entries')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.total}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('today')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.today}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('this_week')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{stats.this_week}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1 md:px-3 py-0.5 md:py-2 flex items-center justify-between">
            <span className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400">{t('unique_actions')}</span>
            <span className="text-xs md:text-lg font-bold text-gray-900 dark:text-white">{Object.keys(stats.by_action || {}).length}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-0.5 md:p-3 mb-0.5 md:mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5 md:gap-2">
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('from_date')}</label>
            <input
              type="date"
              value={filters.from_date || ''}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-0.5 md:px-2 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('to_date')}</label>
            <input
              type="date"
              value={filters.to_date || ''}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-0.5 md:px-2 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('action')}</label>
            <Select
              options={actionOptions}
              value={actionOptions.find((opt) => opt.value === filters.action) || null}
              onChange={handleActionSelect}
              isClearable
              placeholder={t('all_actions')}
              styles={customSelectStyles}
              className="w-full"
              classNamePrefix="react-select"
            />
          </div>
          <div>
            <label className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('search')}</label>
            <div className="relative">
              <Search className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('search_in_audit')}
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-5 md:px-6 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>
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
          hideSearch={true}
        />
      </div>
    </div>
  );
};

export default AuditTrailPage;