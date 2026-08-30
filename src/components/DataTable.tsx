import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  // 👇 Custom searchable value – use this if the column's raw value is not directly searchable
  searchValue?: (item: T) => string | number | null | undefined;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  // Pagination – controlled mode
  page?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  // If you want internal pagination, just omit page/totalItems/onPageChange
  itemsPerPage?: number;
  onRefresh?: () => void;
  debounceDelay?: number;
  // Optionally hide search
  hideSearch?: boolean;
}

const DEFAULT_ITEMS_PER_PAGE = 5;
const PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];

/**
 * Recursively extract all primitive strings/numbers from an object/array.
 * Used for deep fallback search.
 */
function extractAllStrings(value: any): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  if (typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractAllStrings(item));
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap((v) => extractAllStrings(v));
  }
  return [];
}

export default function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  page: externalPage,
  totalItems: externalTotal,
  onPageChange,
  onPerPageChange,
  itemsPerPage: initialItemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  onRefresh,
  debounceDelay = 300,
  hideSearch = false,
}: DataTableProps<T>) {
  const { t } = useLanguage();

  // --- Internal state (used only if not controlled) ---
  const [internalPage, setInternalPage] = useState(1);
  const [internalItemsPerPage, setInternalItemsPerPage] = useState(initialItemsPerPage);

  // Determine if we are controlled
  const isControlled = externalPage !== undefined && onPageChange !== undefined && onPerPageChange !== undefined;
  const currentPage = isControlled ? externalPage : internalPage;
  const itemsPerPage = isControlled ? (initialItemsPerPage) : internalItemsPerPage; // controlled uses parent's itemsPerPage

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceDelay);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchTerm, debounceDelay]);

  // Reset page to 1 when search changes (only in uncontrolled mode)
  useEffect(() => {
    if (!isControlled) {
      setInternalPage(1);
    }
    // If controlled, parent should reset page
  }, [debouncedSearchTerm, isControlled]);

  // --- Filter data ---
  const filteredData = useMemo(() => {
    const term = debouncedSearchTerm.trim();
    if (!term) return data;

    const lowerTerm = term.toLowerCase();
    const isNumeric = /^-?\d+(\.\d+)?$/.test(term);
    const numericTerm = isNumeric ? Number(term) : null;

    return data.filter((item) => {
      // 1. Check each column's searchValue or raw value
      const columnMatch = columns.some((col) => {
        let rawValue: any;
        if (col.searchValue) {
          rawValue = col.searchValue(item);
        } else {
          rawValue = item[col.key as keyof T];
        }

        if (rawValue === undefined || rawValue === null) return false;

        // Exact numeric match
        if (isNumeric && typeof rawValue === 'number') {
          return rawValue === numericTerm;
        }

        // Convert to string (handle objects) and do substring match
        const stringValue = typeof rawValue === 'object'
          ? JSON.stringify(rawValue)
          : String(rawValue);
        return stringValue.toLowerCase().includes(lowerTerm);
      });

      if (columnMatch) return true;

      // 2. Fallback: deep search over the entire row (covers nested data not in columns)
      const allRowStrings = extractAllStrings(item);
      return allRowStrings.some((str) => str.toLowerCase().includes(lowerTerm));
    });
  }, [data, debouncedSearchTerm, columns]);

  // --- Pagination calculations ---
  const totalItems = isControlled ? (externalTotal ?? filteredData.length) : filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = isControlled
    ? filteredData.slice(startIndex, startIndex + itemsPerPage)
    : filteredData.slice(startIndex, startIndex + itemsPerPage);

  // --- Handlers ---
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      if (isControlled) {
        onPageChange?.(page);
      } else {
        setInternalPage(page);
      }
    }
  }, [totalPages, isControlled, onPageChange]);

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    if (isControlled) {
      onPerPageChange?.(val);
      onPageChange?.(1);
    } else {
      setInternalItemsPerPage(val);
      setInternalPage(1);
    }
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    if (!isControlled) setInternalPage(1);
    if (onRefresh) onRefresh();
  };

  const currentItemsPerPage = isControlled ? itemsPerPage : internalItemsPerPage;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
        {title && <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Search */}
          {!hideSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('search_table')}
                className="pl-9 pr-3 py-1.5 w-48 sm:w-56 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
              />
            </div>
          )}

          {/* Items per page */}
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
              {t('items_per_page')}:
            </label>
            <select
              value={currentItemsPerPage}
              onChange={handleItemsPerPageChange}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {PER_PAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
            title={t('refresh')}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-700/80 backdrop-blur-sm">
            <tr className="text-left text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase tracking-wider">
              {columns.map((col) => (
                <th key={String(col.key)} className="px-4 py-3 border-b border-gray-200 dark:border-slate-600 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500 italic">
                  {t('no_results')}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={index}
                  className={`transition hover:bg-orange-50 dark:hover:bg-slate-700/60 ${
                    index % 2 === 0 ? 'bg-white dark:bg-slate-800/50' : 'bg-gray-50/50 dark:bg-slate-800/30'
                  }`}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-2.5 text-gray-700 dark:text-gray-200">
                      {col.render ? col.render(item) : (item[col.key as keyof T] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination info & controls */}
      {totalItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm flex-shrink-0">
          <span className="text-gray-600 dark:text-gray-400">
            {t('showing')} {startIndex + 1} – {Math.min(startIndex + currentItemsPerPage, totalItems)} {t('of')} {totalItems} {t('entries')}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {t('previous')}
            </button>
            <span className="px-3 py-1 rounded-lg bg-orange-500 text-white font-medium min-w-[3rem] text-center">
              {currentPage}
            </span>
            <span className="text-gray-500 dark:text-gray-400">/ {totalPages || 1}</span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}