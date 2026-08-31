// src/context/ProductContext.tsx

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import * as productApiModule from '../services/productApi';
const productApi = productApiModule as any;
const categoryApi = productApiModule as any;
const shopApi = productApiModule as any;
const companyApi = productApiModule as any;;
import { Product, ProductFormData, ProductFilters, ProductCategory, Shop, Company } from '../types/product';
import toast from 'react-hot-toast';

interface ProductContextType {
  products: Product[];
  loading: boolean;
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  fetchProducts: () => Promise<void>;
  createProduct: (data: ProductFormData) => Promise<void>;
  updateProduct: (id: string, data: Partial<ProductFormData>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  restoreProduct: (id: string) => Promise<void>;
  forceDeleteProduct: (id: string) => Promise<void>;
  changeProductStatus: (id: string, status: string) => Promise<void>;

  // Dropdown data
  categories: ProductCategory[];
  shops: Shop[];
  companies: Company[];
  loadDropdowns: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>({ per_page: 1000 });
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productApi.index(filters);
      setProducts(res.data.data.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [catRes, shopRes, compRes] = await Promise.all([
        categoryApi.dropdown(),
        shopApi.dropdown(),
        companyApi.dropdown(),
      ]);
      setCategories(catRes.data.data || []);
      setShops(shopRes.data.data || []);
      setCompanies(compRes.data.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load dropdown data');
    }
  };

  // Load products when filters change
  useEffect(() => {
    fetchProducts();
  }, [filters]);

  // Load dropdowns on mount
  useEffect(() => {
    loadDropdowns();
  }, []);

  const createProduct = async (data: ProductFormData) => {
    try {
      await productApi.store(data);
      toast.success('Product(s) created successfully');
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
      throw err;
    }
  };

  const updateProduct = async (id: string, data: Partial<ProductFormData>) => {
    try {
      await productApi.update(id, data);
      toast.success('Product updated successfully');
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productApi.destroy(id);
      toast.success('Product deleted');
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
      throw err;
    }
  };

  const restoreProduct = async (id: string) => {
    try {
      await productApi.restore(id);
      toast.success('Product restored');
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore product');
      throw err;
    }
  };

  const forceDeleteProduct = async (id: string) => {
    try {
      await productApi.forceDelete(id);
      toast.success('Product permanently deleted');
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to force delete product');
      throw err;
    }
  };

  const changeProductStatus = async (id: string, status: string) => {
    try {
      await productApi.changeStatus(id, status);
      toast.success(`Status changed to ${status}`);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change status');
      throw err;
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        filters,
        setFilters,
        fetchProducts,
        createProduct,
        updateProduct,
        deleteProduct,
        restoreProduct,
        forceDeleteProduct,
        changeProductStatus,
        categories,
        shops,
        companies,
        loadDropdowns,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProducts must be used within ProductProvider');
  return ctx;
}; // ✅ Added missing closing brace