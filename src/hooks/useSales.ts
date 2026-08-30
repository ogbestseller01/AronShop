// hooks/useSales.ts
import { useState, useEffect, useCallback } from 'react';
import { saleApi } from '../services/api';
import { Sale, SaleFilters, SaleStats, SaleFormData } from '../types';
import toast from 'react-hot-toast';

interface UseSalesOptions {
  initialFilters?: SaleFilters;
  autoFetch?: boolean;
}

export const useSales = (options: UseSalesOptions = {}) => {
  const { initialFilters = {}, autoFetch = true } = options;

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<SaleFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [stats, setStats] = useState<SaleStats | null>(null);

  const fetchSales = useCallback(async () => {
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
      if (data.stats) {
        setStats(data.stats);
      }
      // Optionally fetch stats separately
      try {
        const statsRes = await saleApi.getStats(filters);
        if (statsRes.data?.data) {
          setStats(statsRes.data.data);
        }
      } catch (statsErr) {
        // stats are optional, ignore
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch sales');
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage]);

  useEffect(() => {
    if (autoFetch) {
      fetchSales();
    }
  }, [fetchSales, autoFetch]);

  const refresh = () => fetchSales();

  const updateFilters = (newFilters: Partial<SaleFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const createSale = async (data: SaleFormData) => {
    try {
      const res = await saleApi.store(data);
      toast.success('Sale created successfully');
      await refresh();
      return res.data.data;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sale');
      throw err;
    }
  };

  const updateSale = async (id: string, data: Partial<SaleFormData>) => {
    try {
      const res = await saleApi.update(id, data);
      toast.success('Sale updated successfully');
      await refresh();
      return res.data.data;
    } catch (err: any) {
      toast.error(err.message || 'Failed to update sale');
      throw err;
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await saleApi.destroy(id);
      toast.success('Sale deleted successfully');
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete sale');
      throw err;
    }
  };

  return {
    sales,
    loading,
    total,
    page,
    perPage,
    filters,
    stats,
    setPage,
    setPerPage,
    setFilters,
    updateFilters,
    refresh,
    fetchSales,
    createSale,
    updateSale,
    deleteSale,
  };
};

export default useSales;