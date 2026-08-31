// src/pages/DashboardOverview.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Store,
  Package,
  Tag,
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  PackageOpen,
} from 'lucide-react';

// ====== Types ======
interface DashboardData {
  summary: {
    total_users?: number;
    total_shops: number;
    total_products: number;
    products_in_stock: number;
    total_product_categories: number;
    total_sales: number;
    total_returned: number;
    total_roles?: number;
    total_permissions?: number;
    total_companies?: number;
  };
  charts: {
    products_by_category: Array<{
      category: string;
      in_stock: number;
      sold: number;
      returned: number;
    }>;
    products_by_status: Record<string, number>;
    sales_by_payment_method: Array<{ method: string; count: number; total_amount: number }>;
    top_selling_products: Array<{
      product_id: string;
      imei: string;
      sku: string;
      category_name: string;
      model: string;
      shop_name: string;
      shop_location: string;
      sales_count: number;
    }>;
  };
  trends: {
    sales_trend: Array<{ date: string; amount: number }>;
    sales_by_month: Array<{ month: string; total_amount: number }>;
  };
}

// ====== Constants ======
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'];

// ====== Helpers ======
/** Format a number with commas (full) – used for tooltips */
const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString('en-US');
};

/** Compact format: 1K, 10K, 100K, 1M, etc. – used for chart axes */
const formatCompactNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '0';
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toString();
};

/** Truncate a string to a max length and add ellipsis */
const truncateText = (text: string | undefined, maxLen: number = 20): string => {
  if (!text) return '—';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
};

/** Custom tooltip formatter – shows full numbers with commas */
const tooltipFormatter = (value: any, name: any): [any, any] => {
  if (typeof value === 'number') {
    return [formatNumber(value), name];
  }
  return [value, name];
};

// ====== Main Component ======
const DashboardOverview: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/v20/dashboard');
      setData(res.data.data);
      setError(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load dashboard';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw size={48} className="animate-spin text-orange-500" />
          <p className="text-gray-600 dark:text-gray-400">{t('loading_dashboard')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{t('error_loading_dashboard')}</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">{error}</p>
          <button
            onClick={fetchDashboard}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition"
          >
            <RefreshCw size={16} />
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  const { summary, charts, trends } = data;
  const isAdminOrManager = summary.total_users !== undefined;

  // Null safety for products_by_status
  const statusData = charts.products_by_status
    ? Object.entries(charts.products_by_status).map(([name, value]) => ({ name, value }))
    : [];

  const safeProductsByCategory = charts.products_by_category || [];
  const safeSalesByPaymentMethod = charts.sales_by_payment_method || [];
  const safeTopSellingProducts = charts.top_selling_products || [];
  const safeSalesTrend = trends.sales_trend || [];
  const safeSalesByMonth = trends.sales_by_month || [];

  // ====== Render ======
  return (
    <div className="space-y-6">
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdminOrManager && (
          <>
            <SummaryCard
              icon={<Users className="text-blue-500" />}
              label={t('total_users')}
              value={formatNumber(summary.total_users)}
            />
            <SummaryCard
              icon={<Store className="text-cyan-500" />}
              label={t('total_companies')}
              value={formatNumber(summary.total_companies)}
            />
          </>
        )}
        <SummaryCard
          icon={<Store className="text-green-500" />}
          label={t('total_shops')}
          value={formatNumber(summary.total_shops)}
        />
        <SummaryCard
          icon={<PackageOpen className="text-indigo-500" />}
          label={t('total_products')}
          value={formatNumber(summary.total_products)}
        />
        <SummaryCard
          icon={<Package className="text-orange-500" />}
          label={t('products_in_stock')}
          value={formatNumber(summary.products_in_stock)}
        />
        <SummaryCard
          icon={<Tag className="text-teal-500" />}
          label={t('product_categories')}
          value={formatNumber(summary.total_product_categories)}
        />
        <SummaryCard
          icon={<ShoppingCart className="text-blue-600" />}
          label={t('total_sales')}
          value={formatNumber(summary.total_sales)}
        />
        <SummaryCard
          icon={<AlertCircle className="text-red-500" />}
          label={t('returned_devices')}
          value={formatNumber(summary.total_returned)}
        />
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PRODUCTS BY CATEGORY */}
        <ChartCard title={t('products_by_category')}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={safeProductsByCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
                tickFormatter={(val) => truncateText(val, 15)}
              />
              <YAxis
                tickFormatter={formatCompactNumber}
                scale="auto"
                width={60}
              />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="in_stock" stackId="a" fill="#f97316" name={t('in_stock')} />
              <Bar dataKey="sold" stackId="a" fill="#3b82f6" name={t('sold')} />
              <Bar dataKey="returned" stackId="a" fill="#10b981" name={t('returned')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* PRODUCTS BY STATUS (Pie) */}
        <ChartCard title={t('products_by_status')}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => {
                  const pct = ((percent ?? 0) * 100).toFixed(0);
                  return `${truncateText(name, 12)} ${pct}%`;
                }}
              >
                {statusData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* CHARTS ROW 2 – Sales by Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('sales_by_payment_method')}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={safeSalesByPaymentMethod} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="method"
                tick={{ fontSize: 12 }}
                angle={-30}
                textAnchor="end"
                height={60}
                interval={0}
                tickFormatter={(val) => truncateText(val, 15)}
              />
              <YAxis
                tickFormatter={formatCompactNumber}
                width={70}
                scale="auto"
              />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="count" fill="#f97316" name={t('count')} />
              <Bar dataKey="total_amount" fill="#fb923c" name={t('total_amount')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* TOP SELLING PRODUCTS TABLE */}
        <ChartCard title={t('top_selling_products')}>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('product')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('model')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('imei')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('sku')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('shop')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('shop_location')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {safeTopSellingProducts.map((p, idx) => (
                  <tr key={p.product_id || idx}>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={p.category_name}>
                      {p.category_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[100px] truncate" title={p.model}>
                      {p.model || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={p.imei}>
                      {p.imei || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[100px] truncate" title={p.sku}>
                      {p.sku || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={p.shop_name}>
                      {p.shop_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={p.shop_location}>
                      {p.shop_location || '—'}
                    </td>
                  </tr>
                ))}
                {safeTopSellingProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">{t('no_data')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* TRENDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('sales_trend_30_days')}>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={safeSalesTrend} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                height={60}
                interval="preserveStartEnd"
                tickFormatter={(val) => truncateText(val, 10)}
              />
              <YAxis
                tickFormatter={formatCompactNumber}
                width={70}
                scale="auto"
              />
              <Tooltip formatter={tooltipFormatter} />
              <Line type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('sales_by_month')}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={safeSalesByMonth} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                height={60}
                interval="preserveStartEnd"
                tickFormatter={(val) => truncateText(val, 12)}
              />
              <YAxis
                tickFormatter={formatCompactNumber}
                width={70}
                scale="auto"
              />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="total_amount" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

// ====== Helper Components ======

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value }) => (
  <div className="border rounded-lg p-4 flex items-center gap-4 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 min-h-[80px]">
    <div className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 flex-shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white truncate" title={String(value)}>
        {value}
      </p>
    </div>
  </div>
);

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 min-h-[380px] flex flex-col">
    <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4 flex-shrink-0 truncate" title={title}>
      {title}
    </h3>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

export default DashboardOverview;