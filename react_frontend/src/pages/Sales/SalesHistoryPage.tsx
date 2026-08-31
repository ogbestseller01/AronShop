// @ts-nocheck
// src/pages/Sales/SalesHistoryPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { saleApi } from '../../services/api';
import { Sale } from '../../types';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { X } from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

const getErrorMessage = (err: any): string => {
  if (err.response?.data?.errors) {
    const errors = err.response.data.errors;
    const messages = Object.values(errors).flat().join(' ');
    return messages || err.response?.data?.message || err.message || 'Operation failed';
  }
  return err.response?.data?.message || err.message || 'Operation failed';
};

const selectStyles = {
  control: (provided: any) => ({
    ...provided,
    backgroundColor: '#fff',
    borderColor: '#d1d5db',
    boxShadow: 'none',
    '&:hover': { borderColor: '#f97316' },
    minHeight: '38px',
    borderRadius: '0.5rem',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#f97316' : state.isFocused ? '#ffedd5' : 'transparent',
    color: state.isSelected ? '#fff' : '#111827',
  }),
  menu: (provided: any) => ({ ...provided, zIndex: 9999 }),
  singleValue: (provided: any) => ({ ...provided, color: '#111827' }),
};

const SalesHistoryPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [filters, setFilters] = useState<{ status?: string }>({});
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);

  // Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const canView = hasPermission('sales.view');
  const canEdit = hasPermission('sales.edit');

  const fetchSales = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = {
        ...filters,
        page,
        per_page: perPage,
      };
      const res = await saleApi.index(params);
      const data = res.data.data;
      setSales(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, canView]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const updateSaleStatus = async (saleId: string, newStatus: string, reason?: string) => {
    if (!canEdit) {
      toast.error('You do not have permission to update sales');
      return;
    }
    setUpdatingSaleId(saleId);
    try {
      const payload: any = { status: newStatus };
      if (newStatus === 'cancelled' && reason) {
        payload.cancellation_reason = reason;
      }
      await saleApi.update(saleId, payload);
      toast.success(`Sale status updated to ${newStatus}`);
      await fetchSales();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const openCancelModal = (saleId: string) => {
    setCancelSaleId(saleId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    if (cancelSaleId) {
      await updateSaleStatus(cancelSaleId, 'cancelled', cancelReason.trim());
      setShowCancelModal(false);
      setCancelSaleId(null);
      setCancelReason('');
    }
  };

  const columns = [
    {
      key: 'product',
      label: t('product'),
      searchValue: (item: Sale) => {
        const p = item.product;
        if (!p) return '';
        const categoryName = p.category?.category_name || '';
        const model = p.category?.model || '';
        return `${categoryName} ${model} ${p.sku || ''} ${p.imei || ''}`.trim();
      },
      render: (item: Sale) => {
        const p = item.product;
        if (!p) return <span className="text-gray-400">—</span>;
        const categoryName = p.category?.category_name || 'N/A';
        const model = p.category?.model || 'N/A';
        const sku = p.sku || '—';
        const imei = p.imei || '—';
        return (
          <div>
            <div className="font-medium">{categoryName} - {model}</div>
            <div className="text-xs text-gray-500 space-x-1">
              <span>SKU: {sku}</span>
              <span className="mx-1">|</span>
              <span>IMEI: {imei}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'agent',
      label: t('agent'),
      render: (item: Sale) => item.agent?.name || '—',
    },
    {
      key: 'total_amount',
      label: t('total_amount'),
      render: (item: Sale) => `TSh ${item.total_amount.toLocaleString()}`,
    },
    {
      key: 'payment_method',
      label: t('payment_method'),
      render: (item: Sale) => (
        <Badge tone={item.payment_method === 'cash' ? 'green' : 'blue'}>{t(item.payment_method)}</Badge>
      ),
    },
    {
      key: 'company',
      label: t('company'),
      render: (item: Sale) => {
        if (item.payment_method === 'loan' && item.company) {
          return <span>{item.company.company_name}</span>;
        }
        return <span className="text-gray-400">—</span>;
      },
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: Sale) => {
        const colorMap: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
          pending: 'yellow',
          completed: 'green',
          cancelled: 'red',
          refunded: 'gray',
        };
        return <Badge tone={colorMap[item.status] || 'gray'}>{t(item.status)}</Badge>;
      },
    },
    {
      key: 'cancellation_reason',
      label: t('cancellation_reason'),
      render: (item: Sale) => item.cancellation_reason || '—',
    },
    {
      key: 'created_at',
      label: t('created_at'),
      render: (item: Sale) => new Date(item.created_at).toLocaleString(),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Sale) => {
        const isUpdating = updatingSaleId === item.sale_id;
        const currentStatus = item.status;
        const isCancelled = currentStatus === 'cancelled';

        return (
          <div className="flex items-center gap-2">
            {canEdit && !isCancelled && (
              <button
                onClick={() => openCancelModal(item.sale_id)}
                disabled={isUpdating}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition disabled:opacity-60"
              >
                {t('cancel_sale')}
              </button>
            )}
            {canEdit && isCancelled && (
              <button
                onClick={() => updateSaleStatus(item.sale_id, 'completed')}
                disabled={isUpdating}
                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition disabled:opacity-60"
              >
                {t('restore')}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">You do not have permission to view sales.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2 gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sales_history')}</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          options={[
            { value: '', label: t('all_statuses') },
            { value: 'completed', label: t('completed') },
            { value: 'cancelled', label: t('cancelled') },
            { value: 'pending', label: t('pending') },
          ]}
          value={filters.status ? { value: filters.status, label: t(filters.status) } : null}
          onChange={(option: any) => setFilters({ ...filters, status: option?.value || '' })}
          isClearable
          placeholder={t('filter_by_status')}
          styles={selectStyles}
          className="w-48"
        />
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : sales}
          itemsPerPage={perPage}
          totalItems={total}
          page={page}
          onPageChange={(newPage) => setPage(newPage)}
          onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
          onRefresh={fetchSales}
        />
      </div>

      {/* Cancel Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('cancel_sale')}</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('provide_cancellation_reason')}
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('enter_reason')}
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[80px]"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                {t('confirm_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;