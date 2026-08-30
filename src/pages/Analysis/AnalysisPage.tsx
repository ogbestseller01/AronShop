// @ts-nocheck
// src/pages/Analysis/AnalysisPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { reportApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  Store,
  Package,
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  Calendar,
  Tag,
  CreditCard,
} from 'lucide-react';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#14b8a6', '#f472b6', '#6366f1', '#ec4899'];

// ---- Safe formatter for weekly tick (handles string or number) ----
const formatWeekTick = (value: any): string => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.length < 6) return str;
  const year = parseInt(str.substring(0, 4), 10);
  const week = parseInt(str.substring(4), 10);
  if (isNaN(year) || isNaN(week)) return str;
  const firstJan = new Date(year, 0, 1);
  const daysOffset = (firstJan.getDay() + 6) % 7;
  const firstMonday = new Date(year, 0, 1 + (week - 1) * 7 - daysOffset);
  const month = firstMonday.toLocaleString('default', { month: 'short' });
  return `W${week} ${month}`;
};

const AnalysisPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission('reports.sales.view');

  const fetchAnalysis = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await reportApi.analysis();
      setData(res.data.data);
      setError(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('error_loading_analysis'));
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canView, t]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{t('access_denied')}</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">{t('you_do_not_have_permission')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw size={48} className="animate-spin text-orange-500" />
          <p className="text-gray-600 dark:text-gray-400">{t('loading_analysis')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{t('error_loading_analysis')}</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">{error}</p>
          <button
            onClick={fetchAnalysis}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition"
          >
            <RefreshCw size={16} />
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  // ---- Safe data extraction ----
  const sales_overview = data?.sales_overview ?? {};
  const payment_method_breakdown = data?.payment_method_breakdown ?? [];
  const category_sales = data?.category_sales ?? [];
  const daily_trend = data?.daily_trend ?? [];
  const weekly_trend = data?.weekly_trend ?? [];
  const monthly_trend = data?.monthly_trend ?? [];
  const agent_performance = data?.agent_performance ?? [];
  const shop_performance = data?.shop_performance ?? [];
  const product_performance = data?.product_performance ?? [];
  const model_sales = data?.model_sales ?? [];
  const interest_summary = data?.interest_summary ?? {};
  const profit_trends = data?.profit_trends ?? [];
  const stock_summary = data?.stock_summary ?? {};
  const agent_ranking_by_sales = data?.agent_ranking_by_sales ?? [];

  const paymentData = payment_method_breakdown.map((p: any) => ({
    name: p?.method || 'Unknown',
    value: p?.total ?? 0,
  }));

  const categoryData = category_sales.map((c: any) => ({
    name: c?.category || 'Unknown',
    value: c?.revenue ?? 0,
  }));

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('analysis_dashboard')}</h1>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<ShoppingCart className="text-blue-500" size={24} />} label={t('total_sales')} value={sales_overview.total_sales ?? 0} />
        <SummaryCard icon={<DollarSign className="text-emerald-500" size={24} />} label={t('total_revenue')} value={`TSh ${(sales_overview.total_revenue ?? 0).toLocaleString()}`} />
        <SummaryCard icon={<TrendingUp className="text-orange-500" size={24} />} label={t('total_profit')} value={`TSh ${(sales_overview.total_profit ?? 0).toLocaleString()}`} />
        <SummaryCard icon={<Package className="text-purple-500" size={24} />} label={t('total_stock_cost')} value={`TSh ${(stock_summary.total_stock_cost ?? 0).toLocaleString()}`} />
      </div>

      {/* TREND CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title={t('daily_trend_30d')} icon={<Calendar className="text-blue-500" size={18} />}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={daily_trend} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('weekly_trend')} icon={<Calendar className="text-indigo-500" size={18} />}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weekly_trend} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 9, angle: -45, textAnchor: 'end' }}
                height={70}
                tickFormatter={formatWeekTick}
                interval={0}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('monthly_trend')} icon={<Calendar className="text-cyan-500" size={18} />}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthly_trend} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* PAYMENT & CATEGORY BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('sales_by_payment_method')} icon={<CreditCard className="text-green-500" size={18} />}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={paymentData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={{ stroke: '#888' }}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                
              >
                {paymentData.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('revenue_by_category')} icon={<Tag className="text-orange-500" size={18} />}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={{ stroke: '#888' }}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                
              >
                {categoryData.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* PERFORMANCE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('top_agents_by_revenue')} icon={<Users className="text-blue-500" size={18} />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agent_performance} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agent_name" tick={{ fontSize: 10, angle: -20, textAnchor: 'end' }} height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="total_revenue" fill="#f97316" name={t('revenue')} />
              <Bar dataKey="total_sales" fill="#3b82f6" name={t('sales')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('top_shops_by_revenue')} icon={<Store className="text-green-500" size={18} />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={shop_performance} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="shop_name" tick={{ fontSize: 10, angle: -20, textAnchor: 'end' }} height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="total_revenue" fill="#f97316" name={t('revenue')} />
              <Bar dataKey="total_sales" fill="#3b82f6" name={t('sales')} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* PRODUCT & MODEL TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('top_products_by_revenue')} icon={<Package className="text-purple-500" size={18} />}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left">{t('sku')}</th>
                  <th className="px-3 py-2 text-left">{t('category')}</th>
                  <th className="px-3 py-2 text-left">{t('model')}</th>
                  <th className="px-3 py-2 text-right">{t('sales')}</th>
                  <th className="px-3 py-2 text-right">{t('revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {product_performance.slice(0, 10).map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-3 py-2">{p?.sku || '—'}</td>
                    <td className="px-3 py-2">{p?.category || '—'}</td>
                    <td className="px-3 py-2">{p?.model || '—'}</td>
                    <td className="px-3 py-2 text-right">{p?.total_sales ?? 0}</td>
                    <td className="px-3 py-2 text-right">TSh {(p?.total_revenue ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title={t('top_models_by_revenue')} icon={<Tag className="text-pink-500" size={18} />}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left">{t('model')}</th>
                  <th className="px-3 py-2 text-right">{t('sales')}</th>
                  <th className="px-3 py-2 text-right">{t('revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {model_sales.slice(0, 10).map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-3 py-2">{m?.model || '—'}</td>
                    <td className="px-3 py-2 text-right">{m?.sales ?? 0}</td>
                    <td className="px-3 py-2 text-right">TSh {(m?.revenue ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* PROFIT TRENDS & INTEREST SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('profit_trends')} icon={<TrendingUp className="text-cyan-500" size={18} />}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={profit_trends} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="profit" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('interest_summary')} icon={<DollarSign className="text-emerald-500" size={18} />}>
          <div className="space-y-3">
            <div className="font-medium text-sm text-gray-600 dark:text-gray-400">{t('loan')}</div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600 dark:text-gray-400">{t('total_loan_sales')}</span>
              <span className="font-bold">{interest_summary.total_loan_sales ?? 0}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600 dark:text-gray-400">{t('total_loan_revenue')}</span>
              <span className="font-bold">TSh {(interest_summary.total_loan_revenue ?? 0).toLocaleString()}</span>
            </div>


            <div className="font-medium text-sm text-gray-600 dark:text-gray-400 mt-2">{t('cash')}</div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600 dark:text-gray-400">{t('total_cash_sales')}</span>
              <span className="font-bold">{interest_summary.total_cash_sales ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('total_cash_revenue')}</span>
              <span className="font-bold">TSh {(interest_summary.total_cash_revenue ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* STOCK SUMMARY & AGENT RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('stock_summary')} icon={<Package className="text-orange-500" size={18} />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stock_summary.in_stock ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('in_stock')}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stock_summary.sold ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('sold')}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stock_summary.returned ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('returned')}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stock_summary.total_products ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('total_products')}</div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title={t('agent_ranking_by_sales')} icon={<Users className="text-blue-500" size={18} />}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left">{t('rank')}</th>
                  <th className="px-3 py-2 text-left">{t('agent')}</th>
                  <th className="px-3 py-2 text-right">{t('sales')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {agent_ranking_by_sales.slice(0, 10).map((a: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{a?.agent_name || '—'}</td>
                    <td className="px-3 py-2 text-right">{a?.total_sales ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// ---- Helper Components ----
interface SummaryCardProps { icon: React.ReactNode; label: string; value: string | number; }
const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm">
    <div className="p-2 rounded-full bg-gray-100 dark:bg-slate-700">{icon}</div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

interface ChartCardProps { title: string; icon: React.ReactNode; children: React.ReactNode; }
const ChartCard: React.FC<ChartCardProps> = ({ title, icon, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    </div>
    {children}
  </div>
);

export default AnalysisPage;