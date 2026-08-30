// src/pages/Reports/ReportsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { reportApi, shopApi, userApi, categoryApi } from '../../services/api';
import { Sale, Product, Shop, User, ProductCategory } from '../../types';
import toast from 'react-hot-toast';
import Select from 'react-select';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

type ReportType = 'sales' | 'stock' | 'returns';

// Compact select styles for mobile
const selectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: '#fff',
    borderColor: state.isFocused ? '#f97316' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(251, 146, 60, 0.5)' : 'none',
    '&:hover': { borderColor: '#f97316' },
    minHeight: '28px',
    fontSize: '10px',
    borderRadius: '0.375rem',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#f97316' : state.isFocused ? '#ffedd5' : 'transparent',
    color: state.isSelected ? '#fff' : '#111827',
    fontSize: '10px',
  }),
  menu: (provided: any) => ({ ...provided, zIndex: 99999 }),
  menuPortal: (provided: any) => ({ ...provided, zIndex: 99999 }),
  singleValue: (provided: any) => ({ ...provided, color: '#111827', fontSize: '10px' }),
  input: (provided: any) => ({ ...provided, color: '#111827', fontSize: '10px' }),
  placeholder: (provided: any) => ({ ...provided, color: '#6b7280', fontSize: '10px' }),
  valueContainer: (provided: any) => ({ ...provided, padding: '0 4px' }),
  indicatorsContainer: (provided: any) => ({ ...provided, height: '22px' }),
};

const ReportsPage: React.FC = () => {
  const { t, lang } = useLanguage(); // <-- get lang as well
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<ReportType>('sales');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [filters, setFilters] = useState<any>({});
  const [shops, setShops] = useState<Shop[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  const canViewSales = hasPermission('reports.sales.view');
  const canViewStock = hasPermission('reports.stock.view');
  const canViewReturns = hasPermission('reports.returns.view');

  // ---- Load dropdowns (conditional) ----
  const loadDropdowns = useCallback(async () => {
    try {
      if (activeTab === 'sales') {
        const [agentRes, shopRes] = await Promise.all([
          reportApi.agentsWithSales(),
          reportApi.shopsWithSales(),
        ]);
        const agentData = agentRes?.data?.data ?? [];
        const shopData = shopRes?.data?.data ?? [];

        setAgents(
          Array.isArray(agentData)
            ? agentData.map((item: any) => ({ id: item.id, name: item.name }))
            : []
        );
        setShops(
          Array.isArray(shopData)
            ? shopData.map((item: any) => ({
                shop_id: item.shop_id,
                name: item.name,
                location: item.location || '',
              }))
            : []
        );
        setCategories([]);
      } else {
        const [shopRes, agentRes, catRes] = await Promise.all([
          shopApi.dropdown(),
          userApi.dropdown(),
          categoryApi.dropdown(),
        ]);

        const shopData = shopRes?.data?.data ?? shopRes?.data ?? [];
        const agentData = agentRes?.data?.data ?? agentRes?.data ?? [];
        const catData = catRes?.data?.data ?? catRes?.data ?? [];

        setShops(
          Array.isArray(shopData)
            ? shopData.map((item: any) => ({
                shop_id: item.id || item.shop_id || item.value,
                name: item.label || item.name || 'Unknown Shop',
                location: item.location || '',
              }))
            : []
        );
        setAgents(
          Array.isArray(agentData)
            ? agentData.map((item: any) => ({
                id: item.id || item.value,
                name: item.label || item.name || 'Unknown Agent',
              }))
            : []
        );
        setCategories(
          Array.isArray(catData)
            ? catData.map((item: any) => ({
                category_id: item.value || item.id,
                category_name: item.label || item.name || 'Unknown Category',
              }))
            : []
        );
      }
    } catch (err: any) {
      console.error('Failed to load dropdowns:', err);
      toast.error(err?.response?.data?.message || 'Failed to load filter options');
      setShops([]);
      setAgents([]);
      setCategories([]);
    }
  }, [activeTab]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  // ---- Fetch report data ----
  const fetchReport = useCallback(async () => {
    if (!canViewSales && !canViewStock && !canViewReturns) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let res;
      const params = { ...filters, page, per_page: perPage };

      if (activeTab === 'sales') {
        res = await reportApi.sales(params);
      } else if (activeTab === 'stock') {
        res = await reportApi.stock(params);
      } else if (activeTab === 'returns') {
        res = await reportApi.returns(params);
      }

      const payload = res?.data?.data;
      const paginator = payload?.data;
      const items = paginator?.data;

      setData(Array.isArray(items) ? items : []);
      setTotalItems(paginator?.total ?? 0);
      setSummary(payload?.summary ?? {});
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load report');
      setData([]);
      setTotalItems(0);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, page, perPage, canViewSales, canViewStock, canViewReturns]);

  useEffect(() => {
    if (activeTab === 'sales' && !canViewSales) return;
    if (activeTab === 'stock' && !canViewStock) return;
    if (activeTab === 'returns' && !canViewReturns) return;
    fetchReport();
  }, [fetchReport, activeTab, canViewSales, canViewStock, canViewReturns]);

  // ---- Open product modal ----
  const openProductModal = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // ---- EXPORT FUNCTIONS ----
  const fetchAllDataForExport = async () => {
    const limit = 1000;
    let allItems: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    try {
      do {
        const params = { ...filters, page: currentPage, per_page: limit };
        let res;
        if (activeTab === 'sales') {
          res = await reportApi.sales(params);
        } else if (activeTab === 'stock') {
          res = await reportApi.stock(params);
        } else {
          res = await reportApi.returns(params);
        }
        const payload = res?.data?.data;
        const paginator = payload?.data;
        const items = paginator?.data || [];
        allItems = allItems.concat(items);
        totalPages = paginator?.last_page || 1;
        currentPage++;
      } while (currentPage <= totalPages);

      return allItems;
    } catch (error) {
      throw error;
    }
  };

  const formatExportData = (rawData: any[]) => {
    if (activeTab === 'sales') {
      return rawData.map((item: any) => {
        const p = item.product;
        const productName = p
          ? `${p.category?.category_name || ''} ${p.category?.model || ''} (SKU: ${p.sku || ''}, IMEI: ${p.imei || ''})`
          : '—';
        const shopName = p?.shop ? `${p.shop.name}${p.shop.location ? ` (${p.shop.location})` : ''}` : '—';
        return {
          Product: productName,
          Agent: item.agent?.name || '—',
          Shop: shopName,
          Amount: item.total_amount || 0,
          'Payment Method': item.payment_method || '',
          'Created At': item.created_at ? new Date(item.created_at).toLocaleString() : '',
        };
      });
    } else if (activeTab === 'stock') {
      return rawData.map((item: any) => ({
        Category: item.category?.category_name || '—',
        SKU: item.sku || '—',
        IMEI: item.imei || '—',
        Model: item.category?.model || '—',
        Shop: item.shop ? `${item.shop.name}${item.shop.location ? ` (${item.shop.location})` : ''}` : '—',
        'Stock Status': item.stock_status || '—',
        Status: item.status || '—',
        'Buying Price': item.buying_price || 0,
        'Cash Selling Price': item.cash_selling_price || 0,
      }));
    } else {
      // returns
      return rawData.map((item: any) => ({
        Category: item.category?.category_name || '—',
        SKU: item.sku || '—',
        IMEI: item.imei || '—',
        Shop: item.shop ? `${item.shop.name}${item.shop.location ? ` (${item.shop.location})` : ''}` : '—',
        Status: item.status || '—',
        'Updated At': item.updated_at ? new Date(item.updated_at).toLocaleString() : '',
      }));
    }
  };

  const downloadFile = (content: string | ArrayBuffer, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const raw = await fetchAllDataForExport();
      const formatted = formatExportData(raw);
      if (formatted.length === 0) {
        toast.warning('No data to export');
        setExporting(false);
        return;
      }
      const headers = Object.keys(formatted[0]);
      const csvRows = [];
      csvRows.push(headers.join(','));
      for (const row of formatted) {
        const values = headers.map(header => {
          const val = row[header] ?? '';
          const str = String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        });
        csvRows.push(values.join(','));
      }
      const csvContent = csvRows.join('\n');
      downloadFile(csvContent, `${activeTab}_report_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
      toast.success('CSV exported successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const raw = await fetchAllDataForExport();
      const formatted = formatExportData(raw);
      if (formatted.length === 0) {
        toast.warning('No data to export');
        setExporting(false);
        return;
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(formatted);
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `${activeTab}_report_${new Date().toISOString().slice(0,10)}.xlsx`;
      downloadFile(wbout, fileName, 'application/octet-stream');
      toast.success('Excel exported successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  // ---- Column definitions (now depend on t) ----
  const salesColumns = useMemo(() => [
    {
      key: 'product',
      label: t('product'),
      render: (item: any) => {
        const p = item.product;
        if (!p) return '—';
        const categoryName = p.category?.category_name || '';
        const model = p.category?.model || '';
        const sku = p.sku || '';
        const imei = p.imei || '';
        const parts = [];
        if (categoryName) parts.push(categoryName);
        if (model) parts.push(model);
        if (sku) parts.push(`SKU: ${sku}`);
        if (imei) parts.push(`IMEI: ${imei}`);
        return parts.join(' | ');
      },
    },
    {
      key: 'agent',
      label: t('agent'),
      render: (item: any) => item.agent?.name || '—',
    },
    {
      key: 'shop',
      label: t('shop'),
      render: (item: any) => {
        const shop = item.product?.shop;
        if (!shop) return '—';
        const name = shop.name || '';
        const location = shop.location ? ` (${shop.location})` : '';
        return `${name}${location}`;
      },
    },
    {
      key: 'total_amount',
      label: t('total_amount'),
      render: (item: any) => `TSh ${(item.total_amount ?? 0).toLocaleString()}`,
    },
    {
      key: 'payment_method',
      label: t('payment_method'),
      render: (item: any) => (
        <Badge tone={item.payment_method === 'cash' ? 'green' : 'blue'}>
          {t(item.payment_method)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: t('created_at'),
      render: (item: any) => new Date(item.created_at).toLocaleString(),
    },
  ], [t]);

  const stockColumns = useMemo(() => [
    {
      key: 'product',
      label: t('product'),
      render: (item: any) => {
        const category = item.category?.category_name || '';
        const model = item.category?.model || '';
        const sku = item.sku || '';
        const imei = item.imei || '';
        const parts = [];
        if (category) parts.push(category);
        if (model) parts.push(model);
        if (sku) parts.push(`SKU: ${sku}`);
        if (imei) parts.push(`IMEI: ${imei}`);
        const display = parts.length ? parts.join(' | ') : '—';
        return (
          <button
            onClick={() => openProductModal(item)}
            className="text-gray-900 dark:text-white hover:underline text-left text-[10px] md:text-sm"
          >
            {display}
          </button>
        );
      },
    },
    {
      key: 'shop',
      label: t('shop'),
      render: (item: any) => {
        const shop = item.shop;
        if (!shop) return '—';
        const name = shop.name || '';
        const location = shop.location ? ` (${shop.location})` : '';
        return `${name}${location}`;
      },
    },
    {
      key: 'stock_status',
      label: t('stock_status'),
      render: (item: any) => {
        const colors: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
          in_stock: 'green',
          transferred: 'blue',
          received: 'blue',
          sold: 'red',
          pending_return: 'yellow',
          returned: 'yellow',
        };
        return <Badge tone={colors[item.stock_status] || 'gray'}>{t(item.stock_status)}</Badge>;
      },
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: any) => {
        const colors: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
          active: 'green',
          inactive: 'gray',
          sold: 'blue',
          returned: 'yellow',
        };
        return <Badge tone={colors[item.status] || 'gray'}>{t(item.status)}</Badge>;
      },
    },
  ], [t]);

  const returnsColumns = useMemo(() => [
    {
      key: 'category',
      label: t('category'),
      render: (item: any) => item.category?.category_name || '—',
    },
    {
      key: 'sku',
      label: t('sku'),
      render: (item: any) => item.sku,
    },
    {
      key: 'imei',
      label: t('imei'),
      render: (item: any) => item.imei,
    },
    {
      key: 'shop',
      label: t('shop'),
      render: (item: any) => {
        const shop = item.shop;
        if (!shop) return '—';
        const name = shop.name || '';
        const location = shop.location ? ` (${shop.location})` : '';
        return `${name}${location}`;
      },
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: any) => {
        const colors: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
          returned: 'yellow',
          pending_return: 'yellow',
        };
        return <Badge tone={colors[item.status] || 'gray'}>{t(item.status)}</Badge>;
      },
    },
    {
      key: 'updated_at',
      label: t('updated_at'),
      render: (item: any) => new Date(item.updated_at).toLocaleString(),
    },
  ], [t]);

  // ✅ Now currentColumns depends on t and activeTab
  const currentColumns = useMemo(() => {
    if (activeTab === 'sales') return salesColumns;
    if (activeTab === 'stock') return stockColumns;
    return returnsColumns;
  }, [activeTab, salesColumns, stockColumns, returnsColumns]);

  // ---- Filters UI ----
  const renderFilters = () => {
    const shopOptions = shops.map((s) => ({
      value: s.shop_id,
      label: s.location ? `${s.name} (${s.location})` : s.name,
    }));

    const agentOptions = agents.map((a) => ({
      value: a.id,
      label: a.name,
    }));

    const categoryOptions = categories.map((c) => ({
      value: c.category_id,
      label: c.category_name,
    }));

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-2 items-end relative">
        {activeTab === 'sales' && (
          <>
            <div>
              <label className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('from_date')}</label>
              <input
                type="date"
                value={filters.from_date || ''}
                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-1 md:px-2 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('to_date')}</label>
              <input
                type="date"
                value={filters.to_date || ''}
                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded px-1 md:px-2 py-0.5 text-[8px] md:text-xs focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('agent')}</label>
              <Select
                options={agentOptions}
                value={filters.agent_id ? agentOptions.find((o) => o.value === filters.agent_id) : null}
                onChange={(opt: any) => setFilters({ ...filters, agent_id: opt?.value || '' })}
                isClearable
                placeholder={t('select_agent')}
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                className="w-full"
              />
            </div>
          </>
        )}

        {(activeTab === 'stock' || activeTab === 'returns') && (
          <div>
            <label className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('category')}</label>
            <Select
              options={categoryOptions}
              value={filters.category_id ? categoryOptions.find((o) => o.value === filters.category_id) : null}
              onChange={(opt: any) => setFilters({ ...filters, category_id: opt?.value || '' })}
              isClearable
              placeholder={t('all_categories')}
              styles={selectStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              className="w-full"
            />
          </div>
        )}

        <div>
          <label className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('shop')}</label>
          <Select
            options={shopOptions}
            value={filters.shop_id ? shopOptions.find((o) => o.value === filters.shop_id) : null}
            onChange={(opt: any) => setFilters({ ...filters, shop_id: opt?.value || '' })}
            isClearable
            placeholder={t('all_shops')}
            styles={selectStyles}
            menuPortalTarget={document.body}
            menuPosition="fixed"
            className="w-full"
          />
        </div>

        {activeTab === 'stock' && (
          <div>
            <label className="text-[8px] md:text-xs text-gray-500 dark:text-gray-400 block mb-0.5">{t('stock_status')}</label>
            <Select
              options={[
                { value: '', label: t('all') },
                { value: 'in_stock', label: t('in_stock') },
                { value: 'sold', label: t('sold') },
                { value: 'returned', label: t('returned') },
              ]}
              value={filters.stock_status ? { value: filters.stock_status, label: t(filters.stock_status) } : null}
              onChange={(opt: any) => setFilters({ ...filters, stock_status: opt?.value || '' })}
              isClearable
              placeholder={t('select_stock_status')}
              styles={selectStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              className="w-full"
            />
          </div>
        )}
      </div>
    );
  };

  // ---- Summary cards ----
  const renderSummary = () => {
    if (!summary || Object.keys(summary).length === 0) return null;

    const filteredSummary = Object.fromEntries(
      Object.entries(summary).filter(([key]) => key !== 'damaged')
    );

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 md:gap-3 mb-2 md:mb-4">
        {Object.entries(filteredSummary).map(([key, value]) => {
          if (typeof value === 'number') {
            const label = key === 'total_profit' ? t('total_profit') : t(key);
            const display = (key.includes('amount') || key.includes('revenue') || key === 'total_profit')
              ? `TSh ${value.toLocaleString()}`
              : value;
            return (
              <div key={key} className="bg-white dark:bg-slate-800 rounded-lg border p-1 md:p-3 text-center">
                <p className="text-[6px] md:text-xs text-gray-500 dark:text-gray-400 uppercase truncate">{label}</p>
                <p className="text-xs md:text-lg font-bold text-gray-900 dark:text-white truncate">{display}</p>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  // ---- Product Details Modal ----
  const ProductModal = () => {
    if (!selectedProduct) return null;
    const p = selectedProduct;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
              {t('product_details')}
            </h3>
            <button
              onClick={() => setIsModalOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-xs md:text-sm">
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('sku')}</span>
              <span className="font-mono">{p.sku || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('imei')}</span>
              <span className="font-mono">{p.imei || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('category')}</span>
              <span>{p.category?.category_name || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('model')}</span>
              <span>{p.category?.model || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('shop')}</span>
              <span>{p.shop?.name || '—'} {p.shop?.location ? `(${p.shop.location})` : ''}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('buying_price')}</span>
              <span>TSh {p.buying_price?.toLocaleString() || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('cash_selling_price')}</span>
              <span>TSh {p.cash_selling_price?.toLocaleString() || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('stock_status')}</span>
              <Badge tone={p.stock_status === 'in_stock' ? 'green' : 'gray'}>{t(p.stock_status)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('status')}</span>
              <Badge tone={p.status === 'active' ? 'green' : 'gray'}>{t(p.status)}</Badge>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---- Tabs ----
  const tabs = [
    { key: 'sales' as const, label: t('sales_report'), permission: 'reports.sales.view' },
    { key: 'stock' as const, label: t('stock_report'), permission: 'reports.stock.view' },
    { key: 'returns' as const, label: t('returns_report'), permission: 'reports.returns.view' },
  ];

  const visibleTabs = tabs.filter((tab) => hasPermission(tab.permission));

  if (!visibleTabs.length) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">You do not have permission to view any reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 md:mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-1 md:py-2 gap-1 md:gap-2">
        <h1 className="text-sm md:text-2xl font-bold text-gray-900 dark:text-white">{t('reports')}</h1>

        {/* Export buttons – responsive */}
        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-[8px] md:text-sm font-medium transition shadow-md"
          >
            {exporting ? <Loader2 size={12} className="md:w-4 md:h-4 animate-spin" /> : <Download size={12} className="md:w-4 md:h-4" />}
            <span className="hidden xs:inline">{t('export_csv')}</span>
            <span className="xs:hidden">CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-[8px] md:text-sm font-medium transition shadow-md"
          >
            {exporting ? <Loader2 size={12} className="md:w-4 md:h-4 animate-spin" /> : <FileSpreadsheet size={12} className="md:w-4 md:h-4" />}
            <span className="hidden xs:inline">{t('export_excel')}</span>
            <span className="xs:hidden">Excel</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 mb-1 md:mb-4 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
              setFilters({});
            }}
            className={`px-2 md:px-4 py-1 md:py-2 text-[8px] md:text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-1 md:mb-4 overflow-x-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-1 md:p-3">
        {renderFilters()}
      </div>

      {/* Summary */}
      {renderSummary()}

      {/* Table – key with language forces re-render on language change */}
      <div className="flex-1 min-h-0">
        <DataTable
          key={`${activeTab}-${lang}`} // ✅ force re‑render when language changes
          title={t(activeTab + '_report')}
          columns={currentColumns}
          data={loading ? [] : (Array.isArray(data) ? data : [])}
          itemsPerPage={perPage}
          totalItems={totalItems}
          page={page}
          onPageChange={(newPage) => setPage(newPage)}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          onRefresh={fetchReport}
          showSearch={true}
        />
      </div>

      {/* Product Modal */}
      {isModalOpen && <ProductModal />}
    </div>
  );
};

export default ReportsPage;