// // pages/Sales/SaleModal.tsx
// import React, { useState, useEffect } from 'react';
// import { useLanguage } from '../../context/LanguageContext';
// import { saleApi } from '../../services/api';
// import { Product } from '../../types';
// import toast from 'react-hot-toast';
// import { X, RefreshCw } from 'lucide-react';
//
// interface SaleModalProps {
//   open: boolean;
//   onClose: (refresh?: boolean) => void;
//   product: Product | null;
// }
//
// const SaleModal: React.FC<SaleModalProps> = ({ open, onClose, product }) => {
//   const { t } = useLanguage();
//   const [loading, setLoading] = useState(false);
//   const [formData, setFormData] = useState({
//     product_id: '',
//     total_amount: 0,
//     payment_method: 'cash',
//     status: 'completed',
//     notes: '',
//   });
//
//   useEffect(() => {
//     if (product) {
//       setFormData(prev => ({
//         ...prev,
//         product_id: product.product_id,
//         total_amount: product.cash_selling_price || 0,
//       }));
//     }
//   }, [product]);
//
//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({
//       ...prev,
//       [name]: name === 'total_amount' ? parseFloat(value) || 0 : value,
//     }));
//   };
//
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!formData.product_id) {
//       toast.error('Product ID is required');
//       return;
//     }
//     if (formData.total_amount <= 0) {
//       toast.error('Total amount must be greater than 0');
//       return;
//     }
//
//     setLoading(true);
//     try {
//       await saleApi.store(formData);
//       toast.success('Sale created successfully');
//       onClose(true);
//     } catch (err: any) {
//       const msg = err.response?.data?.message || err.message || 'Failed to create sale';
//       toast.error(msg);
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   if (!open) return null;
//
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
//             {t('make_sale')}
//           </h3>
//           <button
//             onClick={() => onClose(false)}
//             className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
//           >
//             <X size={20} />
//           </button>
//         </div>
//
//         <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg">
//           <p className="text-sm text-gray-600 dark:text-gray-300">
//             <strong>{t('product')}:</strong> {product?.sku} ({product?.imei})
//           </p>
//           <p className="text-sm text-gray-600 dark:text-gray-300">
//             <strong>{t('category')}:</strong> {product?.category?.category_name}
//           </p>
//           <p className="text-sm text-gray-600 dark:text-gray-300">
//             <strong>{t('cash_selling_price')}:</strong> TSh {product?.cash_selling_price?.toLocaleString()}
//           </p>
//         </div>
//
//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div>
//             <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
//               {t('total_amount')} <span className="text-red-500">*</span>
//             </label>
//             <input
//               type="number"
//               step="0.01"
//               name="total_amount"
//               value={formData.total_amount}
//               onChange={handleChange}
//               className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
//               required
//             />
//           </div>
//
//           <div>
//             <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
//               {t('payment_method')}
//             </label>
//             <select
//               name="payment_method"
//               value={formData.payment_method}
//               onChange={handleChange}
//               className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
//             >
//               <option value="cash">{t('cash')}</option>
//               <option value="loan">{t('loan')}</option>
//               <option value="mpesa">{t('mpesa')}</option>
//               <option value="bank">{t('bank')}</option>
//             </select>
//           </div>
//
//           <div>
//             <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
//               {t('notes')}
//             </label>
//             <textarea
//               name="notes"
//               value={formData.notes || ''}
//               onChange={handleChange}
//               rows={2}
//               className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
//             />
//           </div>
//
//           <div className="flex gap-2 pt-2">
//             <button
//               type="submit"
//               disabled={loading}
//               className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
//             >
//               {loading ? <RefreshCw size={16} className="animate-spin" /> : t('confirm_sale')}
//             </button>
//             <button
//               type="button"
//               onClick={() => onClose(false)}
//               className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2.5 text-sm font-medium"
//             >
//               {t('cancel')}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// };
//
// export default SaleModal;