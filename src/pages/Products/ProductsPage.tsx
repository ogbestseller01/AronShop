// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { productApi, categoryApi, shopApi, companyApi } from '../../services/api';
import { Product, ProductFormData, ProductLoanPrice, ProductCategory, Shop, Company } from '../../types';
import toast from 'react-hot-toast';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Select from 'react-select';
import {
  Edit,
  Trash2,
  X,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Archive,
  Scan,
  Info,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

// --- Helper to extract detailed error messages from API ---
const getErrorMessage = (err: any): string => {
  if (err.response?.data?.errors) {
    const errors = err.response.data.errors;
    const messages = Object.values(errors).flat().join(' ');
    return messages || err.response?.data?.message || err.message || 'Operation failed';
  }
  return err.response?.data?.message || err.message || 'Operation failed';
};

// --- IMEI validation (format + Luhn checksum) -----------------------------
// A real IMEI is exactly 15 digits and passes the Luhn checksum.
const luhnCheck = (value: string): boolean => {
  let sum = 0;
  let alternate = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let n = parseInt(value[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
};

const validateImei = (raw: string): { valid: boolean; error?: string } => {
  const value = (raw || '').trim();
  if (!value) return { valid: false, error: 'IMEI is required' };
  if (!/^\d+$/.test(value)) return { valid: false, error: 'IMEI must contain digits only' };
  if (value.length !== 15) {
    return { valid: false, error: `IMEI must be exactly 15 digits (currently ${value.length})` };
  }
  if (!luhnCheck(value)) return { valid: false, error: 'Invalid IMEI (checksum failed)' };
  return { valid: true };
};

const sanitizeImeiInput = (value: string) => value.replace(/\D/g, '').slice(0, 15);

// --- React Select custom styles ---
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

// --- Confirm Dialog ---
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
  const bgColor =
    confirmVariant === 'red'
      ? 'bg-red-600 hover:bg-red-700'
      : confirmVariant === 'green'
      ? 'bg-green-600 hover:bg-green-700'
      : 'bg-blue-600 hover:bg-blue-700';
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

// --- Compact scanner box (shared by create & edit modes) ---
const ScannerBox: React.FC<{ onStop: () => void }> = ({ onStop }) => (
  <div className="mt-3 flex justify-center">
    <div className="border-2 border-orange-300 dark:border-orange-700 rounded-lg overflow-hidden bg-black w-full max-w-[320px] shadow-lg">
      <div id="scanner-reader" style={{ width: '100%', height: '210px' }} />
      <div className="px-2 py-1.5 bg-gray-900 flex items-center justify-between">
        <span className="text-[11px] text-gray-300 flex items-center gap-1">
          <Scan size={12} className="animate-pulse text-orange-400" />
          Scanning…
        </span>
        <button
          type="button"
          onClick={onStop}
          className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-[11px] font-medium"
        >
          Stop
        </button>
      </div>
    </div>
  </div>
);

const ProductsPage: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission, user } = useAuth();

  // ----- State -----
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // --- Current user's managed shops ---
  const [userShops, setUserShops] = useState<Shop[]>([]);

  // --- Purchase Info ---
  const [purchaseInfo, setPurchaseInfo] = useState<any>(null);
  const [loadingPurchaseInfo, setLoadingPurchaseInfo] = useState(false);
  const [autoFilledBuyingPrice, setAutoFilledBuyingPrice] = useState<number | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isForceDeleteModalOpen, setIsForceDeleteModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ProductFormData>({
    shop_id: null,
    category_id: '',
    sku: '',
    imeis: '',
    buying_price: null,
    cash_selling_price: null,
    loan_selling_price: [],
    status: 'active',
  });

  // SKU options for the current category
  const [skuOptions, setSkuOptions] = useState<string[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  // IMEI list
  const [imeiList, setImeiList] = useState<string[]>([]);
  const [manualImei, setManualImei] = useState<string>('');

  // Loan prices
  const [loanPrices, setLoanPrices] = useState<ProductLoanPrice[]>([]);

  // Scanner ref
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  // Debounce ref so the same barcode isn't re-processed multiple times per second
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Company names for loan price display
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  // Permissions
  const canView = hasPermission('products.view');
  const canCreate = hasPermission('products.create');
  const canEdit = hasPermission('products.edit');
  const canDelete = hasPermission('products.delete');
  const canRestore = hasPermission('products.restore');
  const canForceDelete = hasPermission('products.force_delete');
  const canChangeStatus = hasPermission('products.change_status');

  // ----- Fetch current user's managed shops -----
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
      const userManagedShops = allShops.filter(shop => shop.manager_id === user.id);
      setUserShops(userManagedShops as any as any);
    } catch (err) {
      console.error('Failed to fetch user shops:', err);
      setUserShops([] as any as any);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchUserShops();
  }, [fetchUserShops, user?.id]);

  const isAdminOrManager = user?.role?.name === 'ADMINISTRATOR' || user?.role?.name === 'MANAGER';

  // ----- Fetch Products -----
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        per_page: perPage,
      };
      const res = await productApi.index(params);
      setProducts(res.data.data.data || []);
      setTotal(res.data.data.total || 0);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    if (canView) fetchProducts();
  }, [fetchProducts, canView]);

  // ----- Load Dropdowns -----
  const loadDropdowns = async () => {
    try {
      const [catRes, shopRes, compRes] = await Promise.all([
        categoryApi.dropdown(),
        shopApi.dropdown(),
        companyApi.dropdown(),
      ]);

      // Categories
      const categoriesData = (catRes.data.data || []).map((item: any) => {
        const categoryName = item.name || item.label || 'Unknown';
        let model = item.model || '';
        if (!model && item.label && item.label !== categoryName) {
          const match = item.label.match(/\(([^)]+)\)/);
          if (match) model = match[1];
          else {
            const parts = item.label.split(/[-|]/).map((s: string) => s.trim());
            if (parts.length > 1 && parts[0] === categoryName) {
              model = parts.slice(1).join(' - ');
            }
          }
        }
        return {
          category_id: item.value || item.id,
          category_name: categoryName,
          model: model || '',
          sku: item.skus || [],
        };
      });
      setCategories(categoriesData as any);

      // Shops – all shops (will be filtered later for non-admin)
      const shopsData = (shopRes.data.data || []).map((item: any) => ({
        shop_id: item.id,
        name: item.name || item.shop_name || item.label || 'Unknown Shop',
        location: item.location || '',
      }));
      setShops(shopsData as any);

      // Companies
      const companiesData = (compRes.data.data || []).map((item: any) => ({
        id: item.id,
        company_name: item.label,
      }));
      setCompanies(companiesData as any);

      const nameMap: Record<string, string> = {};
      companiesData.forEach(c => { nameMap[c.id] = c.company_name; });
      setCompanyNames(nameMap);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  useEffect(() => {
    if (canView) loadDropdowns();
  }, [canView]);

  // Update SKU options when category changes
  useEffect(() => {
    const selectedCat = categories.find(c => c.category_id === formData.category_id);
    setSkuOptions(selectedCat?.sku || []);
    setSelectedSku(null);
    setPurchaseInfo(null);
    setAutoFilledBuyingPrice(null);
    setIsAutoFilled(false);
  }, [formData.category_id, categories]);

  // ----- Fetch Purchase Info when SKU changes (only if one SKU selected) -----
  const fetchPurchaseInfo = async (categoryId: string, sku: string) => {
    if (!categoryId || !sku) {
      setPurchaseInfo(null);
      setAutoFilledBuyingPrice(null);
      setIsAutoFilled(false);
      return;
    }

    setLoadingPurchaseInfo(true);
    try {
      const res = await productApi.getPurchaseInfo({ category_id: categoryId, sku });
      if (res.data?.success) {
        const data = res.data.data;
        setPurchaseInfo(data);

        if (data.unit_price && data.purchase_exists) {
          const unitPrice = parseFloat(data.unit_price);
          setAutoFilledBuyingPrice(unitPrice);
          setIsAutoFilled(true);
          setFormData(prev => {
            if (!prev.buying_price || prev.buying_price === 0) {
              return { ...prev, buying_price: unitPrice };
            }
            return prev;
          });
        } else {
          setAutoFilledBuyingPrice(null);
          setIsAutoFilled(false);
        }
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch purchase info:', err);
      }
      setPurchaseInfo(null);
      setAutoFilledBuyingPrice(null);
      setIsAutoFilled(false);
    } finally {
      setLoadingPurchaseInfo(false);
    }
  };

  // ----- Handle SKU selection (single) -----
  const handleSkuSelect = (sku: string | null) => {
    setSelectedSku(sku);
    if (sku) {
      fetchPurchaseInfo(formData.category_id, sku);
    } else {
      setPurchaseInfo(null);
      setAutoFilledBuyingPrice(null);
      setIsAutoFilled(false);
    }
  };

  // ----- Close dropdown on outside click -----
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ----- Open create/edit modal -----
  const handleOpenModal = (product?: Product) => {
    let initialShopId: string | null = null;
    if (!product && !isAdminOrManager) {
      if (userShops.length === 1) {
        initialShopId = userShops[0].shop_id;
      } else if (userShops.length > 1) {
        initialShopId = null;
      }
    }

    if (product) {
      setSelectedProduct(product);
      setFormData({
        shop_id: product.shop_id || null,
        category_id: product.category_id,
        sku: product.sku,
        imei: product.imei,
        buying_price: product.buying_price,
        cash_selling_price: product.cash_selling_price || null,
        loan_selling_price: product.loan_selling_price || [],
        status: product.status,
      });
      setSelectedSku(null);
      setImeiList([product.imei]);
      setManualImei('');
      setLoanPrices(product.loan_selling_price || []);
      fetchPurchaseInfo(product.category_id, product.sku);
    } else {
      setSelectedProduct(null);
      setFormData({
        shop_id: initialShopId,
        category_id: '',
        sku: '',
        imeis: '',
        buying_price: null,
        cash_selling_price: null,
        loan_selling_price: [],
        status: 'active',
      });
      setSelectedSku(null);
      setImeiList([]);
      setManualImei('');
      setLoanPrices([]);
      setPurchaseInfo(null);
      setAutoFilledBuyingPrice(null);
      setIsAutoFilled(false);
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(() => {});
      } catch (_) {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  // ----- IMEI management -----
  const removeImeiField = (index: number) => {
    const updated = [...imeiList];
    updated.splice(index, 1);
    setImeiList(updated);
  };
  const clearAllImeis = () => {
    setImeiList([]);
    toast.success('All IMEIs cleared');
  };

  // Manual IMEI add — validated (format + Luhn checksum) before it's accepted
  const handleManualAdd = () => {
    const imei = manualImei.trim();
    const validation = validateImei(imei);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid IMEI');
      return;
    }
    if (imeiList.includes(imei)) {
      toast.error(`IMEI "${imei}" already exists in the list`);
      return;
    }
    setImeiList([...imeiList, imei]);
    setManualImei('');
    toast.success(`IMEI "${imei}" added`);
  };

  // ----- Scanner: compact, faster (higher fps), 1D-barcode aware, validated -----
  useEffect(() => {
    if (!isScanning) {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (_) {}
        scannerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('scanner-reader');
      if (!container) {
        toast.error('Scanner element not found. Please try again.');
        setIsScanning(false);
        return;
      }

      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (_) {}
        scannerRef.current = null;
      }

      let scanner: Html5Qrcode;
      try {
        scanner = new Html5Qrcode('scanner-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        } as any);
      } catch (initErr: any) {
        const msg = initErr.message || initErr.toString() || 'Failed to initialise scanner';
        toast.error('Scanner init error: ' + msg);
        setIsScanning(false);
        return;
      }

      scannerRef.current = scanner;

      const cameraIdOrConfig = { facingMode: 'environment' };
      // Wide, short box tuned for 1D IMEI/serial barcodes; higher fps = faster ("sensitive") detection
      const config = {
        fps: 20,
        qrbox: { width: 260, height: 110 },
        aspectRatio: 1.6,
        disableFlip: false,
      };

      scanner
        .start(
          cameraIdOrConfig,
          config,
          (decodedText) => {
            const imei = decodedText.trim();
            const now = Date.now();

            // Debounce: ignore the exact same code re-fired within 2s (camera keeps re-reading it)
            if (lastScanRef.current.code === imei && now - lastScanRef.current.time < 2000) {
              return;
            }
            lastScanRef.current = { code: imei, time: now };

            const validation = validateImei(imei);
            if (!validation.valid) {
              toast.error(`Rejected "${imei}": ${validation.error}`);
              return; // keep the scanner running, don't accept bad reads
            }

            if (selectedProduct) {
              setImeiList([imei]);
              toast.success(`IMEI updated to "${imei}"`);
              setIsScanning(false);
            } else {
              if (imeiList.includes(imei)) {
                toast.error(`IMEI "${imei}" already exists in the list`);
                return; // keep scanning
              }
              setImeiList(prev => {
                const newList = [...prev];
                if (newList.length > 0 && newList[newList.length - 1] === '') {
                  newList[newList.length - 1] = imei;
                } else {
                  newList.push(imei);
                }
                return newList;
              });
              toast.success(`IMEI "${imei}" scanned and added`);
              // Stay open so multiple units can be scanned back-to-back; user taps Stop when done.
            }
          },
          () => {}
        )
        .catch((err: any) => {
          let errorMsg = 'Could not start camera.';
          if (typeof err === 'string') {
            errorMsg += ' ' + err;
          } else if (err.message) {
            errorMsg += ' ' + err.message;
          } else if (err.toString) {
            errorMsg += ' ' + err.toString();
          }

          if (errorMsg.toLowerCase().includes('permission')) {
            errorMsg = 'Camera permission denied. Please allow camera access in your browser settings.';
          } else if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('no camera')) {
            errorMsg = 'No camera found on this device.';
          }

          toast.error(errorMsg);
          setIsScanning(false);
        });
    }, 50);

    return () => clearTimeout(timer);
  }, [isScanning, selectedProduct, imeiList]);

  const startScanner = () => setIsScanning(true);
  const stopScanner = () => setIsScanning(false);

  // ----- Loan price management -----
  const addLoanPrice = () => setLoanPrices([...loanPrices, { company_id: '', price: 0 }]);
  const removeLoanPrice = (index: number) => {
    const updated = [...loanPrices];
    updated.splice(index, 1);
    setLoanPrices(updated);
  };
  const updateLoanPrice = (index: number, field: keyof ProductLoanPrice, value: string | number) => {
    const updated = [...loanPrices];
    updated[index] = { ...updated[index], [field]: value };
    setLoanPrices(updated);
  };

  // ----- Submit (with IMEI validation as the final safety net) -----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedProduct) {
        const imei = imeiList.length > 0 ? imeiList[0].trim() : '';
        const imeiValidation = validateImei(imei);
        if (!imeiValidation.valid) {
          toast.error(imeiValidation.error || 'Invalid IMEI');
          setIsSubmitting(false);
          return;
        }

        const submitData: ProductFormData = {
          shop_id: formData.shop_id || null,
          category_id: formData.category_id,
          sku: formData.sku,
          imei: imei,
          buying_price: formData.buying_price || undefined,
          cash_selling_price: formData.cash_selling_price || null,
          loan_selling_price: loanPrices.filter(lp => lp.company_id && lp.price > 0),
          status: formData.status,
        };
        await productApi.update(selectedProduct.product_id, submitData);
        toast.success('Product updated successfully');
      } else {
        const imeis = imeiList.map(i => i.trim()).filter(imei => imei !== '');
        if (imeis.length === 0) {
          toast.error('Please add at least one IMEI');
          setIsSubmitting(false);
          return;
        }
        if (!formData.shop_id) {
          toast.error('Please select a shop');
          setIsSubmitting(false);
          return;
        }
        if (!formData.category_id) {
          toast.error('Please select a category');
          setIsSubmitting(false);
          return;
        }
        if (!selectedSku) {
          toast.error('Please select a SKU');
          setIsSubmitting(false);
          return;
        }

        const invalidImeis = imeis
          .map(imei => ({ imei, validation: validateImei(imei) }))
          .filter(r => !r.validation.valid);
        if (invalidImeis.length > 0) {
          toast.error(
            `Fix invalid IMEI(s) before saving: ${invalidImeis.map(r => r.imei).join(', ')}`
          );
          setIsSubmitting(false);
          return;
        }

        const uniqueImeis = new Set(imeis);
        if (uniqueImeis.size !== imeis.length) {
          toast.error('Duplicate IMEIs detected in the list — please remove duplicates');
          setIsSubmitting(false);
          return;
        }

        const baseData: ProductFormData = {
          shop_id: formData.shop_id,
          category_id: formData.category_id,
          sku: '',
          buying_price: formData.buying_price || undefined,
          cash_selling_price: formData.cash_selling_price || null,
          loan_selling_price: loanPrices.filter(lp => lp.company_id && lp.price > 0),
          status: formData.status,
        };

        const submitData = { ...baseData, sku: selectedSku, imeis: imeis.join(',') };
        await productApi.store(submitData);
        toast.success(`Products created for SKU "${selectedSku}" with ${imeis.length} IMEI(s)`);
      }
      await fetchProducts();
      handleCloseModal();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Status change -----
  const handleStatusChange = async (status: string) => {
    if (!selectedProduct) return;
    try {
      await productApi.changeStatus(selectedProduct.product_id, status);
      toast.success(`Status changed to ${status}`);
      await fetchProducts();
      setIsStatusModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const openStatusModal = (product: Product) => {
    setSelectedProduct(product);
    setIsStatusModalOpen(true);
    setDropdownOpen(null);
  };

  // ----- Helper functions for table -----
  const getLoanPricesArray = (product: Product): ProductLoanPrice[] => {
    if (!product?.loan_selling_price) return [];
    const prices = product.loan_selling_price;
    if (Array.isArray(prices)) return prices;
    if (typeof prices === 'string') {
      try { return JSON.parse(prices); } catch { return []; }
    }
    return [];
  };

  // ✅ Clean company name: remove location after dash/em dash
  const getCleanCompanyName = (companyId: string): string => {
    let name = companyNames[companyId];
    if (!name) {
      const company = companies.find(c => c.id === companyId);
      name = company?.company_name || companyId;
    }
    // Remove location after dash or em dash
    const separators = [' — ', ' - ', ' – '];
    for (const sep of separators) {
      const idx = name.indexOf(sep);
      if (idx > 0) {
        return name.substring(0, idx).trim();
      }
    }
    return name;
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price && price !== 0) return '-';
    return `TSh ${Number(price).toLocaleString()}`;
  };

  // ----- Table columns -----
  const columns = [
    {
      key: 'product_details',
      label: t('product_details'),
      render: (item: Product) => {
        const categoryName = item.category?.category_name || 'N/A';
        const model = item.category?.model || 'N/A';
        return `Category: ${categoryName} | Model: ${model}`;
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
      key: 'buying_price',
      label: t('buying_price'),
      render: (item: Product) => formatPrice(item.buying_price),
    },
    {
      key: 'cash_selling_price',
      label: t('cash_selling_price'),
      render: (item: Product) => formatPrice(item.cash_selling_price),
    },
    {
      key: 'loan_selling_price',
      label: t('loan_selling_prices'),
      render: (item: Product) => {
        const loanPrices = getLoanPricesArray(item);
        if (loanPrices.length === 0) {
          return <span className="text-gray-400 text-sm">No loan prices</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {loanPrices.map((lp, idx) => {
              const companyName = getCleanCompanyName(lp.company_id);
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs"
                >
                  <span className="font-medium">{companyName}</span>
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
      key: 'created_at',
      label: t('created_at'),
      render: (item: Product) => new Date(item.created_at).toLocaleString(),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: Product) => (
        <div className="relative" ref={dropdownOpen === item.product_id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.product_id ? null : item.product_id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.product_id && (
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
              {canChangeStatus && !item.deleted_at && (
                <button
                  onClick={() => openStatusModal(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
                >
                  <RefreshCw size={16} />
                  {t('change_status')}
                </button>
              )}
              {item.deleted_at ? (
                <>
                  {canRestore && (
                    <button
                      onClick={() => { setSelectedProduct(item); setIsRestoreModalOpen(true); setDropdownOpen(null); }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-green-600 dark:text-green-400 transition"
                    >
                      <RotateCcw size={16} />
                      {t('restore')}
                    </button>
                  )}
                  {canForceDelete && (
                    <button
                      onClick={() => { setSelectedProduct(item); setIsForceDeleteModalOpen(true); setDropdownOpen(null); }}
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
                    onClick={() => { setSelectedProduct(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
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
            You do not have permission to view products.
          </p>
        </div>
      </div>
    );
  }

  // ----- Determine shop options for the dropdown -----
  let shopOptions = shops.map(s => ({
    value: s.shop_id,
    label: s.name + (s.location ? ` (${s.location})` : '')
  }));

  if (!isAdminOrManager) {
    const userShopIds = userShops.map(s => s.shop_id);
    shopOptions = shopOptions.filter(opt => userShopIds.includes(opt.value));
  }

  const isShopDisabled = !isAdminOrManager && userShops.length === 1;
  const isShopRequired = !isAdminOrManager && userShops.length > 1;

  const manualImeiValidation = manualImei.length > 0 ? validateImei(manualImei) : null;
  const editImei = imeiList[0] || '';
  const editImeiValidation = editImei.length > 0 ? validateImei(editImei) : null;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2 gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('products')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_product')}
          </button>
        )}
      </div>

      {/* Table – showSearch removed */}
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
        />
      </div>

      {/* ===== CREATE/EDIT MODAL ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedProduct ? t('edit_product') : t('add_product')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* === Section: Shop & Category === */}
              <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded"></span>
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                      {t('shop')} {isShopRequired && <span className="text-red-500">*</span>}
                    </label>
                    <Select
                      options={shopOptions}
                      value={
                        formData.shop_id
                          ? shopOptions.find(opt => opt.value === formData.shop_id) || null
                          : null
                      }
                      onChange={(option: any) => setFormData({ ...formData, shop_id: option?.value || null })}
                      isClearable={!isShopDisabled && !isShopRequired}
                      isDisabled={isShopDisabled || !!selectedProduct}
                      placeholder={isShopDisabled ? t('shop_auto_assigned') : t('select_shop')}
                      styles={selectStyles}
                      isSearchable={true}
                    />
                    {isShopDisabled && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Auto‑selected from your assigned shop.
                      </p>
                    )}
                    {isShopRequired && (
                      <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
                        You manage multiple shops – please select one.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                      {t('category')} <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={categories.map(c => ({
                        value: c.category_id,
                        label: `${c.category_name}${c.model ? ` (${c.model})` : ''}`
                      }))}
                      value={
                        categories.find(c => c.category_id === formData.category_id)
                          ? {
                              value: formData.category_id,
                              label: categories.find(c => c.category_id === formData.category_id)
                                ? `${categories.find(c => c.category_id === formData.category_id)?.category_name}${
                                    categories.find(c => c.category_id === formData.category_id)?.model
                                      ? ` (${categories.find(c => c.category_id === formData.category_id)?.model})`
                                      : ''
                                  }`
                                : ''
                            }
                          : null
                      }
                      onChange={(option: any) => {
                        setFormData({ ...formData, category_id: option?.value || '', sku: '' });
                        setSelectedSku(null);
                        setPurchaseInfo(null);
                        setAutoFilledBuyingPrice(null);
                        setIsAutoFilled(false);
                      }}
                      isClearable
                      placeholder={t('select_category')}
                      styles={selectStyles}
                      isDisabled={!!selectedProduct}
                    />
                  </div>
                </div>
              </div>

              {/* === Section: SKU Selection === */}
              <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded"></span>
                  {t('sku')}
                </h4>
                {!selectedProduct ? (
                  <div>
                    {!formData.category_id ? (
                      <p className="text-xs text-yellow-500">{t('select_category_first')}</p>
                    ) : skuOptions.length === 0 ? (
                      <p className="text-xs text-yellow-500">{t('no_skus_for_category')}</p>
                    ) : (
                      <Select
                        options={skuOptions.map(s => ({ value: s, label: s }))}
                        value={selectedSku ? { value: selectedSku, label: selectedSku } : null}
                        onChange={(option: any) => handleSkuSelect(option?.value || null)}
                        isClearable
                        placeholder={t('select_sku')}
                        styles={selectStyles}
                      />
                    )}
                  </div>
                ) : (
                  <Select
                    options={skuOptions.map(s => ({ value: s, label: s }))}
                    value={formData.sku ? { value: formData.sku, label: formData.sku } : null}
                    onChange={(option: any) => {
                      const sku = option?.value || '';
                      setFormData({ ...formData, sku });
                      if (sku) {
                        fetchPurchaseInfo(formData.category_id, sku);
                      } else {
                        setPurchaseInfo(null);
                        setAutoFilledBuyingPrice(null);
                        setIsAutoFilled(false);
                      }
                    }}
                    isClearable
                    placeholder={t('select_sku')}
                    styles={selectStyles}
                    isDisabled={!formData.category_id}
                  />
                )}
              </div>

              {/* === Purchase Info Alert === */}
              {purchaseInfo && purchaseInfo.purchase_exists && (
                <div className={`p-3 rounded-lg border ${purchaseInfo.available_to_add === 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Info size={18} className={purchaseInfo.available_to_add === 0 ? 'text-red-500' : 'text-blue-500'} />
                        <span className="font-medium text-gray-700 dark:text-gray-300">Purchase Info</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Unit Price: <strong>TSh {purchaseInfo.unit_price?.toLocaleString()}</strong> &nbsp;|&nbsp;
                        Purchased: <strong>{purchaseInfo.total_purchased}</strong> &nbsp;|&nbsp;
                        Added: <strong>{purchaseInfo.current_count}</strong> &nbsp;|&nbsp;
                        Available: <strong className={purchaseInfo.available_to_add === 0 ? 'text-red-600' : 'text-green-600'}>
                          {purchaseInfo.available_to_add}
                        </strong>
                        {purchaseInfo.available_to_add === 0 && (
                          <span className="ml-2 text-red-600">⚠️ No more items available</span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowPurchaseDetails(!showPurchaseDetails)}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 mt-1"
                      >
                        {showPurchaseDetails ? 'Hide history' : 'Show purchase history'}
                      </button>
                      {showPurchaseDetails && purchaseInfo.purchases && (
                        <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase History:</p>
                          {purchaseInfo.purchases.map((p: any, idx: number) => (
                            <p key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                              • {p.quantity_ordered} units @ TSh {p.unit_price?.toLocaleString()} ({new Date(p.created_at).toLocaleDateString()})
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    {isAutoFilled && (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
                        Auto-filled
                      </span>
                    )}
                  </div>
                </div>
              )}

              {purchaseInfo && !purchaseInfo.purchase_exists && (
                <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠️ No purchase record found for this category and SKU. Please enter buying price manually.
                  </p>
                </div>
              )}

              {/* === Section: Prices === */}
              <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded"></span>
                  {t('pricing')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                      {t('buying_price')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.buying_price ?? ''}
                      onChange={(e) => {
                        setFormData({ ...formData, buying_price: parseFloat(e.target.value) || 0 });
                        setIsAutoFilled(false);
                      }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                        isAutoFilled ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white'
                      }`}
                      required
                    />
                    {isAutoFilled && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Auto-filled from purchase: TSh {autoFilledBuyingPrice?.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('cash_selling_price')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cash_selling_price ?? ''}
                      onChange={(e) => setFormData({ ...formData, cash_selling_price: parseFloat(e.target.value) || null })}
                      className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              </div>

              {/* === Section: Loan Selling Prices === */}
              <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-4 bg-orange-500 rounded"></span>
                    {t('loan_selling_prices')}
                  </h4>
                  <button
                    type="button"
                    onClick={addLoanPrice}
                    className="text-sm text-orange-500 hover:text-orange-600 font-medium"
                  >
                    + {t('add_loan_price')}
                  </button>
                </div>

                {loanPrices.map((lp, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-center mb-2">
                    <div className="flex-1 min-w-[150px]">
                      <Select
                        options={companies.map(c => ({ value: c.id, label: c.company_name }))}
                        value={companies.find(c => c.id === lp.company_id) ? { value: lp.company_id, label: companies.find(c => c.id === lp.company_id)?.company_name || '' } : null}
                        onChange={(option: any) => updateLoanPrice(idx, 'company_id', option?.value || '')}
                        placeholder={t('select_company')}
                        styles={selectStyles}
                        className="w-full"
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={lp.price || ''}
                        onChange={(e) => updateLoanPrice(idx, 'price', parseFloat(e.target.value) || 0)}
                        placeholder={t('price')}
                        className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLoanPrice(idx)}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {loanPrices.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">No loan prices added yet.</p>
                )}
              </div>

              {/* === Section: IMEI Management === */}
              <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded"></span>
                  {selectedProduct ? t('imei') : t('imei_list')}
                </h4>

                {!selectedProduct ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="flex-1 min-w-[140px] relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={manualImei}
                          onChange={(e) => setManualImei(sanitizeImeiInput(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleManualAdd();
                            }
                          }}
                          maxLength={15}
                          placeholder="Enter 15-digit IMEI"
                          className={`w-full border rounded-lg pl-3 pr-14 py-2 text-sm font-mono focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
                            !manualImeiValidation
                              ? 'border-gray-300 dark:border-slate-600 focus:ring-orange-400'
                              : manualImeiValidation.valid
                              ? 'border-green-400 bg-green-50 dark:bg-green-900/10 focus:ring-green-400'
                              : 'border-red-300 bg-red-50 dark:bg-red-900/10 focus:ring-red-400'
                          }`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">
                          {manualImei.length}/15
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleManualAdd}
                        className="px-2 sm:px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium whitespace-nowrap"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={startScanner}
                        disabled={isScanning}
                        className="px-2 sm:px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                      >
                        <Scan size={16} /> {t('scan')}
                      </button>
                      {imeiList.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllImeis}
                          className="px-2 sm:px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium whitespace-nowrap"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    {manualImeiValidation && !manualImeiValidation.valid && (
                      <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                        <AlertCircle size={12} /> {manualImeiValidation.error}
                      </p>
                    )}

                    {isScanning && <ScannerBox onStop={stopScanner} />}

                    {imeiList.length > 0 && (
                      <div className="overflow-x-auto mt-3">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                          <thead className="bg-gray-100 dark:bg-slate-700/50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IMEI</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valid</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {imeiList.map((imei, idx) => {
                              const rowValidation = validateImei(imei);
                              return (
                                <tr key={idx}>
                                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{idx + 1}</td>
                                  <td className="px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-300">{imei}</td>
                                  <td className="px-3 py-2 text-sm">
                                    {rowValidation.valid ? (
                                      <CheckCircle2 size={16} className="text-green-500" />
                                    ) : (
                                      <span title={rowValidation.error} className="inline-flex">
                                        <AlertCircle size={16} className="text-red-500" />
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeImeiField(idx)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[140px] relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editImei}
                          onChange={(e) => setImeiList([sanitizeImeiInput(e.target.value)])}
                          maxLength={15}
                          placeholder="Enter 15-digit IMEI"
                          className={`w-full border rounded-lg pl-3 pr-14 py-2 text-sm font-mono focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
                            !editImeiValidation
                              ? 'border-gray-300 dark:border-slate-600 focus:ring-orange-400'
                              : editImeiValidation.valid
                              ? 'border-green-400 bg-green-50 dark:bg-green-900/10 focus:ring-green-400'
                              : 'border-red-300 bg-red-50 dark:bg-red-900/10 focus:ring-red-400'
                          }`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">
                          {editImei.length}/15
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={startScanner}
                        disabled={isScanning}
                        className="px-2 sm:px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1 whitespace-nowrap"
                      >
                        <Scan size={16} /> {t('scan')}
                      </button>
                      {isScanning && (
                        <button
                          type="button"
                          onClick={stopScanner}
                          className="px-2 sm:px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium whitespace-nowrap"
                        >
                          Stop
                        </button>
                      )}
                    </div>
                    {editImeiValidation && !editImeiValidation.valid && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={12} /> {editImeiValidation.error}
                      </p>
                    )}
                    {isScanning && <ScannerBox onStop={stopScanner} />}
                  </div>
                )}
              </div>

              {/* === Actions === */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : selectedProduct ? t('update') : t('create')}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2.5 text-sm font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== CONFIRMATION DIALOGS ===== */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        title={t('delete_product')}
        message={t('delete_product_confirm', { imei: selectedProduct?.imei || '' })}
        onConfirm={() => {
          if (selectedProduct) {
            productApi.destroy(selectedProduct.product_id)
              .then(() => {
                toast.success('Product deleted');
                fetchProducts();
              })
              .catch((err) => toast.error(getErrorMessage(err)));
            setIsDeleteModalOpen(false);
          }
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={isRestoreModalOpen}
        title={t('restore_product')}
        message={t('restore_product_confirm', { imei: selectedProduct?.imei || '' })}
        onConfirm={() => {
          if (selectedProduct) {
            productApi.restore(selectedProduct.product_id)
              .then(() => {
                toast.success('Product restored');
                fetchProducts();
              })
              .catch((err) => toast.error(getErrorMessage(err)));
            setIsRestoreModalOpen(false);
          }
        }}
        onCancel={() => setIsRestoreModalOpen(false)}
        confirmVariant="green"
      />

      <ConfirmDialog
        isOpen={isForceDeleteModalOpen}
        title={t('force_delete_product')}
        message={t('force_delete_product_confirm', { imei: selectedProduct?.imei || '' })}
        onConfirm={() => {
          if (selectedProduct) {
            productApi.forceDelete(selectedProduct.product_id)
              .then(() => {
                toast.success('Product permanently deleted');
                fetchProducts();
              })
              .catch((err) => toast.error(getErrorMessage(err)));
            setIsForceDeleteModalOpen(false);
          }
        }}
        onCancel={() => setIsForceDeleteModalOpen(false)}
      />

      {/* ===== CHANGE STATUS MODAL ===== */}
      {isStatusModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('change_product_status')}
              </h3>
              <button
                onClick={() => { setIsStatusModalOpen(false); setSelectedProduct(null); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('current_status')}: <Badge tone="blue">{t(selectedProduct.status)}</Badge>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['active', 'inactive', 'sold', 'returned'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedProduct.status === status
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {t(status)}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setIsStatusModalOpen(false); setSelectedProduct(null); }}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;