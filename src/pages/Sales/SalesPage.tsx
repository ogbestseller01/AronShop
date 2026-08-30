// src/pages/Sales/SalesPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { productApi, saleApi, shopApi, companyApi } from '../../services/api';
import { Product, SaleFormData, Shop, Company, ProductLoanPrice } from '../../types';
import toast from 'react-hot-toast';
import Select from 'react-select';
import {
  Plus,
  X,
  RefreshCw,
  ShoppingCart,
  History,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

// --- Helper ---
const getErrorMessage = (err: any): string => {
  if (err.response?.data?.errors) {
    const errors = err.response.data.errors;
    const messages = Object.values(errors).flat().join(' ');
    return messages || err.response?.data?.message || err.message || 'Operation failed';
  }
  return err.response?.data?.message || err.message || 'Operation failed';
};

// ✅ Enhanced: keep only the part before the first dash or parentheses (removes location)
const getCleanCompanyName = (companyName: string): string => {
  if (!companyName) return 'Unknown';
  // Remove parentheses and their content
  let cleaned = companyName.replace(/\s*\([^)]*\)/g, '').trim();
  // Split on any dash (em dash, en dash, or hyphen) and take the first part
  const parts = cleaned.split(/\s*[—–-]\s*/);
  return parts[0] || cleaned;
};

// --- React Select styles ---
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

interface SalesPageProps {
  setActive?: (page: string) => void;
}

const SalesPage: React.FC<SalesPageProps> = ({ setActive }) => {
  const { t } = useLanguage();
  const { hasPermission, user } = useAuth();

  // ----- State -----
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState<{ status?: string }>({});

  const [userShops, setUserShops] = useState<Shop[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Sale modal state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleForm, setSaleForm] = useState<Partial<SaleFormData>>({
    total_amount: 0,
    payment_method: 'cash',
    status: 'completed',
    notes: '',
  });
  const [selectedLoanCompanyId, setSelectedLoanCompanyId] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Permissions
  const canView = hasPermission('products.view');
  const canCreateSale = hasPermission('sales.create');

  // Determine if user is admin/manager
  const isAdminOrManager =
    user?.role?.name === 'ADMINISTRATOR' ||
    user?.role?.name === 'MANAGER';

  // ----- Memo: clean company names -----
  const cleanCompanyNames = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach(c => {
      map[c.id] = getCleanCompanyName(c.company_name);
    });
    return map;
  }, [companies]);

  // ----- Fetch user's managed shops -----
  const fetchUserShops = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await shopApi.index({ per_page: 1000 });
      const allShops = (res.data.data?.data || res.data.data || []).map((item: any) => ({
        shop_id: item.shop_id || item.id,
        name: item.name || item.shop_name || 'Unknown Shop',
        location: item.location || '',
        manager_id: item.manager_id,
      }));
      const managed = allShops.filter(shop => shop.manager_id === user.id);
      setUserShops(managed);
    } catch (err) {
      console.error('Failed to fetch user shops:', err);
      setUserShops([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchUserShops();
  }, [fetchUserShops, user?.id]);

  // ----- Fetch companies -----
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await companyApi.dropdown();
      const companiesData = (res.data.data || []).map((item: any) => ({
        id: item.id,
        company_name: item.label,
      }));
      setCompanies(companiesData);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ----- Fetch products -----
  const fetchProducts = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params: any = {
        page,
        per_page: perPage,
        status: 'active',
        stock_status: 'in_stock',
        ...filters,
      };
      const res = await productApi.index(params);
      let productData = res.data.data.data || [];

      if (!isAdminOrManager && userShops.length > 0) {
        const shopIds = userShops.map(s => s.shop_id);
        productData = productData.filter((p: Product) => shopIds.includes(p.shop_id));
      }

      setProducts(productData);
      setTotal(productData.length);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters, isAdminOrManager, userShops, canView]);

  useEffect(() => {
    if (canView) fetchProducts();
  }, [fetchProducts, canView]);

  // ----- Open sale modal -----
  const openSaleModal = (product: Product) => {
    setSelectedProduct(product);
    const initialPaymentMethod: 'cash' | 'loan' = 'cash';
    const initialAmount = product.cash_selling_price || 0;
    setSaleForm({
      total_amount: initialAmount,
      payment_method: initialPaymentMethod,
      status: 'completed',
      notes: '',
    });
    setSelectedLoanCompanyId(null);
    setDiscountAmount(0);
    setIsSaleModalOpen(true);
  };

  const closeSaleModal = () => {
    setIsSaleModalOpen(false);
    setSelectedProduct(null);
    setSelectedLoanCompanyId(null);
    setDiscountAmount(0);
  };

  // ----- Helper: get base price -----
  const getBasePrice = useCallback((): number => {
    if (!selectedProduct) return 0;
    if (saleForm.payment_method === 'cash') {
      return selectedProduct.cash_selling_price || 0;
    } else {
      const loanPrices = selectedProduct.loan_selling_price || [];
      const found = loanPrices.find(lp => lp.company_id === selectedLoanCompanyId);
      return found?.price || 0;
    }
  }, [selectedProduct, saleForm.payment_method, selectedLoanCompanyId]);

  // ----- Calculate total (base - discount, min 0) -----
  const calculateTotal = useCallback(() => {
    const base = getBasePrice();
    const discount = discountAmount || 0;
    return Math.max(base - discount, 0);
  }, [getBasePrice, discountAmount]);

  // ----- Update total_amount -----
  useEffect(() => {
    if (selectedProduct) {
      const newTotal = calculateTotal();
      setSaleForm(prev => ({ ...prev, total_amount: newTotal }));
    }
  }, [selectedProduct, saleForm.payment_method, selectedLoanCompanyId, discountAmount, calculateTotal]);

  // ----- Handle payment method change -----
  const handlePaymentMethodChange = (method: 'cash' | 'loan') => {
    if (!selectedProduct) return;
    setSaleForm(prev => ({ ...prev, payment_method: method }));
    setDiscountAmount(0);
    if (method === 'cash') {
      setSelectedLoanCompanyId(null);
    } else {
      const loanPrices = selectedProduct.loan_selling_price || [];
      if (loanPrices.length > 0) {
        const first = loanPrices[0];
        setSelectedLoanCompanyId(first.company_id);
      } else {
        setSelectedLoanCompanyId(null);
      }
    }
  };

  // ----- Handle loan company selection -----
  const handleLoanCompanySelect = (companyId: string) => {
    if (!selectedProduct) return;
    setSelectedLoanCompanyId(companyId);
    setDiscountAmount(0);
  };

  // ----- Handle discount change with validation -----
  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    const base = getBasePrice();
    let clamped = Math.max(val, 0);
    if (clamped > base) {
      clamped = base;
      toast.warning(`Discount cannot exceed base price (TSh ${base.toLocaleString()})`);
    }
    setDiscountAmount(clamped);
  };

  // ----- Submit sale -----
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (saleForm.payment_method === 'loan' && !selectedLoanCompanyId) {
      toast.error('Please select a loan price');
      return;
    }

    const finalAmount = saleForm.total_amount || 0;
    if (finalAmount <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }

    const base = getBasePrice();
    if (discountAmount > base) {
      toast.error(`Discount cannot exceed base price (TSh ${base.toLocaleString()})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const data: SaleFormData = {
        agent_id: user?.id || '',
        product_id: selectedProduct.product_id,
        total_amount: finalAmount,
        payment_method: saleForm.payment_method as any,
        status: 'completed',
        notes: '',
        // Add company_id for loan sales
        company_id: saleForm.payment_method === 'loan' ? selectedLoanCompanyId : undefined,
      };
      await saleApi.store(data);
      toast.success('Sale created successfully');
      await fetchProducts();
      closeSaleModal();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Table columns -----
  const columns = [
    {
      key: 'product_details',
      label: t('product_details'),
      render: (item: Product) => {
        const categoryName = item.category?.category_name || 'N/A';
        const model = item.category?.model || '';
        return (
          <div>
            <div className="font-medium">{categoryName}</div>
            <div className="text-xs text-gray-500">{model}</div>
          </div>
        );
      },
    },
    {
      key: 'sku',
      label: t('sku'),
      render: (item: Product) => <span className="font-mono">{item.sku}</span>,
    },
    {
      key: 'imei',
      label: t('imei'),
      render: (item: Product) => <span className="font-mono text-xs">{item.imei}</span>,
    },
    {
      key: 'shop',
      label: t('shop'),
      render: (item: Product) => {
        if (item.shop) {
          const shopName = item.shop.name || item.shop.shop_name || 'Unknown Shop';
          const location = item.shop.location ? ` (${item.shop.location})` : '';
          return <span>{shopName}{location}</span>;
        }
        return <span className="text-gray-400">—</span>;
      },
    },
    {
      key: 'cash_selling_price',
      label: t('cash_selling_price'),
      render: (item: Product) => item.cash_selling_price ? `TSh ${item.cash_selling_price.toLocaleString()}` : '—',
    },
    {
      key: 'loan_selling_price',
      label: t('loan_selling_prices'),
      render: (item: Product) => {
        const loanPrices = item.loan_selling_price || [];
        if (loanPrices.length === 0) {
          return <span className="text-gray-400 text-sm">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {loanPrices.map((lp, idx) => {
              const company = companies.find(c => c.id === lp.company_id);
              const cleanName = company ? getCleanCompanyName(company.company_name) : 'Unknown';
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs"
                >
                  <span className="font-medium">{cleanName}</span>
                  <span className="text-blue-600 dark:text-blue-400">TSh {lp.price.toLocaleString()}</span>
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: t('status'),
      render: (item: Product) => {
        const colorMap: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
          active: 'green',
          inactive: 'gray',
          sold: 'blue',
          damaged: 'red',
        };
        return <Badge tone={colorMap[item.status] || 'gray'}>{t(item.status)}</Badge>;
      },
    },
    {
      key: 'stock_status',
      label: t('stock_status'),
      render: (item: Product) => {
        const colorMap: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
          in_stock: 'green',
          transferred: 'blue',
          received: 'blue',
          sold: 'red',
          damaged: 'red',
          pending_return: 'yellow',
          returned: 'yellow',
        };
        return <Badge tone={colorMap[item.stock_status] || 'gray'}>{t(item.stock_status)}</Badge>;
      },
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Product) => {
        const isAvailable = item.status === 'active' && item.stock_status === 'in_stock';
        return (
          <button
            onClick={() => openSaleModal(item)}
            disabled={!isAvailable || !canCreateSale}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition ${
              isAvailable && canCreateSale
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <ShoppingCart size={16} />
            {t('make_sale')}
          </button>
        );
      },
    },
  ];

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mt-2">
            You do not have permission to view products.
          </p>
        </div>
      </div>
    );
  }

  const goToSalesHistory = () => {
    if (setActive) {
      setActive('sales_history');
    } else {
      window.location.href = '/sales-history';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2 gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sales')}</h1>
        <button
          onClick={goToSalesHistory}
          className="inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
        >
          <History size={16} />
          {t('sales_history')}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          options={[
            { value: '', label: t('all_statuses') },
            { value: 'active', label: t('active') },
            { value: 'inactive', label: t('inactive') },
            { value: 'sold', label: t('sold') },
            { value: 'returned', label: t('returned') },
          ]}
          value={filters.status ? { value: filters.status, label: t(filters.status) } : null}
          onChange={(option: any) => setFilters({ ...filters, status: option?.value || '' })}
          isClearable
          placeholder={t('filter_by_status')}
          styles={selectStyles}
          className="w-48"
        />
      </div>

      {/* Product Table */}
      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : products}
          itemsPerPage={perPage}
          totalItems={total}
          page={page}
          onPageChange={(newPage) => setPage(newPage)}
          onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
          onRefresh={fetchProducts}
          showSearch={true}
        />
      </div>

      {/* SALE MODAL */}
      {isSaleModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{t('make_sale')}</h3>
              <button onClick={closeSaleModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>{t('product')}:</strong>{' '}
                  {selectedProduct.category?.category_name || 'N/A'} - {selectedProduct.category?.model || 'N/A'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>{t('sku')}:</strong> {selectedProduct.sku}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>{t('imei')}:</strong> {selectedProduct.imei}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>{t('shop')}:</strong> {selectedProduct.shop?.name || '—'}
                  {selectedProduct.shop?.location ? ` (${selectedProduct.shop.location})` : ''}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('payment_method')} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange('cash')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                      saleForm.payment_method === 'cash'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {t('cash')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange('loan')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                      saleForm.payment_method === 'loan'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {t('loan')}
                  </button>
                </div>
              </div>

              {saleForm.payment_method === 'loan' && (
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                    {t('loan_price')} <span className="text-red-500">*</span>
                  </label>
                  {selectedProduct.loan_selling_price && selectedProduct.loan_selling_price.length > 0 ? (
                    <Select
                      options={selectedProduct.loan_selling_price.map((lp: ProductLoanPrice) => {
                        const cleanName = cleanCompanyNames[lp.company_id] || getCleanCompanyName(
                          companies.find(c => c.id === lp.company_id)?.company_name || 'Unknown'
                        );
                        return {
                          value: lp.company_id,
                          label: `${cleanName} - TSh ${lp.price.toLocaleString()}`,
                          price: lp.price,
                        };
                      })}
                      value={
                        selectedLoanCompanyId
                          ? (() => {
                              const found = selectedProduct.loan_selling_price?.find(lp => lp.company_id === selectedLoanCompanyId);
                              if (!found) return null;
                              const cleanName = cleanCompanyNames[selectedLoanCompanyId] || getCleanCompanyName(
                                companies.find(c => c.id === selectedLoanCompanyId)?.company_name || 'Unknown'
                              );
                              return {
                                value: selectedLoanCompanyId,
                                label: `${cleanName} - TSh ${found.price.toLocaleString()}`,
                                price: found.price,
                              };
                            })()
                          : null
                      }
                      onChange={(option: any) => {
                        if (option) {
                          handleLoanCompanySelect(option.value);
                        }
                      }}
                      placeholder={t('select_loan_price')}
                      styles={selectStyles}
                      isClearable={false}
                    />
                  ) : (
                    <p className="text-sm text-yellow-500">{t('no_loan_prices')}</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('discount_amount')} (TSh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount || ''}
                  onChange={handleDiscountChange}
                  placeholder="Enter discount (e.g. 5000)"
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Max discount: TSh {getBasePrice().toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('total_amount')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={saleForm.total_amount || ''}
                  readOnly
                  className="w-full border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-not-allowed"
                />
                {discountAmount > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Discount applied: -TSh {discountAmount.toLocaleString()}
                  </p>
                )}
              </div>

              <input type="hidden" value="completed" />

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : t('confirm_sale')}
                </button>
                <button
                  type="button"
                  onClick={closeSaleModal}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2.5 text-sm font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;