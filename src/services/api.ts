// @ts-nocheck
import axios from 'axios';
// @ts-ignore
import appConfig from '../config';
import toast from 'react-hot-toast';

// Import all types from the central types file
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResendVerificationResponse,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  MeResponse,
  User,
  Role,
  PaginatedData,
  Permission,
  RoleFormData,
  PermissionFormData,
  UserFormData,
  Shop,
  ShopFormData,
  Product,
  ProductFormData,
  ProductFilters,
  ProductCategory,
  ProductCategoryFilters,
  ProductCategoryFormData,
  Company,
  CompanyFormData,
  CompanyFilters,
  AuditTrail,
  AuditTrailFilters,
  AuditTrailStats,
  OTP,
  OTPFilters,
  OTPStats,
  FailedLoginAttempt,
  FailedLoginFilters,
  FailedLoginStats,
  Sale,
  SaleFilters,
  SaleStats,
  SaleFormData,
  SalesReportFilters,
  StockReportFilters,
  ReturnsReportFilters,
  SalesReportData,
  StockReportData,
  ReturnsReportData,
} from '../types';

const baseURL = appConfig.baseURLApi;

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ---------- REQUEST INTERCEPTOR ----------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // ❌ All console.log removed – no API logs anywhere
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- RESPONSE INTERCEPTOR ----------
api.interceptors.response.use(
  (response) => {
    // ❌ No console.log – silent response
    return response;
  },
  (error) => {
    // ⚠️ Keep error logging for debugging (optional – remove if you want complete silence)
    console.error('[API] Error:', error.response?.status, error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      toast.error('Session expired. Please login again.');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ---------- AUTH API ----------
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>('/v1/auth/login', data),

  register: (data: RegisterRequest) =>
    api.post<ApiResponse<RegisterResponse>>('/v1/auth/register', data),

  verifyOTP: (data: VerifyOtpRequest) =>
    api.post<ApiResponse<VerifyOtpResponse>>('/v1/auth/verify-otp', data),

  resendVerification: (data: { email: string }) =>
    api.post<ApiResponse<ResendVerificationResponse>>('/v1/auth/resend-verification', data),

  forgotPassword: (data: { email: string }) =>
    api.post<ApiResponse<ForgotPasswordResponse>>('/v1/auth/forgot-password', data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<ApiResponse<null>>('/v1/auth/reset-password', data),

  logout: () => api.post<ApiResponse<null>>('/v1/auth/logout'),

  me: () => api.get<ApiResponse<MeResponse>>('/v1/auth/me'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    api.put<ApiResponse<MeResponse>>('/v1/auth/profile', data),

  changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    api.post<ApiResponse<null>>('/v1/auth/change-password', data),

  permissions: () => api.get<ApiResponse<string[]>>('/v1/auth/permissions'),
};

// ---------- ROLE API ----------
export const roleApi = {
  index: (params?: { search?: string; per_page?: number }) =>
    api.get<ApiResponse<PaginatedData<Role>>>('/v1/roles', { params }),

  store: (data: RoleFormData) =>
    api.post<ApiResponse<Role>>('/v1/roles', data),

  update: (id: string, data: Partial<RoleFormData>) =>
    api.put<ApiResponse<Role>>(`/v1/roles/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v1/roles/${id}`),

  show: (id: string) =>
    api.get<ApiResponse<Role>>(`/v1/roles/${id}`),

  getPermissions: (id: string) =>
    api.get<ApiResponse<Permission[]>>(`/v1/roles/${id}/permissions`),

  assignPermissions: (id: string, permissionIds: string[]) =>
    api.post<ApiResponse<Role>>(`/v1/roles/${id}/permissions/assign`, { permissions: permissionIds }),

  syncPermissions: (id: string, permissionIds: string[]) =>
    api.post<ApiResponse<Role>>(`/v1/roles/${id}/permissions/sync`, { permissions: permissionIds }),

  revokePermission: (id: string, permissionId: string) =>
    api.post<ApiResponse<Role>>(`/v1/roles/${id}/permissions/revoke`, { permission_id: permissionId }),

  getDropdown: () =>
    api.get<ApiResponse<Role[]>>('/v1/roles/dropdown'),

  getStats: () =>
    api.get<ApiResponse<any>>('/v1/roles/stats'),
};

// ---------- PERMISSION API ----------
export const permissionApi = {
  index: (params?: { search?: string; per_page?: number }) =>
    api.get<ApiResponse<PaginatedData<Permission>>>('/v1/permissions', { params }),

  store: (data: PermissionFormData) =>
    api.post<ApiResponse<Permission>>('/v1/permissions', data),

  update: (id: string, data: Partial<PermissionFormData>) =>
    api.put<ApiResponse<Permission>>(`/v1/permissions/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v1/permissions/${id}`),

  show: (id: string) =>
    api.get<ApiResponse<Permission>>(`/v1/permissions/${id}`),
};

// ---------- USER API ----------
export const userApi = {
  index: (params?: { search?: string; role_id?: string; status?: string; per_page?: number }) =>
    api.get<ApiResponse<PaginatedData<User>>>('/v1/users', { params }),

  store: (data: UserFormData) =>
    api.post<ApiResponse<User>>('/v1/users', data),

  update: (id: string, data: Partial<UserFormData>) =>
    api.put<ApiResponse<User>>(`/v1/users/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v1/users/${id}`),

  show: (id: string) =>
    api.get<ApiResponse<User>>(`/v1/users/${id}`),

  activate: (id: string) =>
    api.patch<ApiResponse<null>>(`/v1/users/${id}/activate`),

  deactivate: (id: string) =>
    api.patch<ApiResponse<null>>(`/v1/users/${id}/deactivate`),

  suspend: (id: string) =>
    api.patch<ApiResponse<null>>(`/v1/users/${id}/suspend`),

  assignRole: (id: string, role_id: string) =>
    api.patch<ApiResponse<User>>(`/v1/users/${id}/role`, { role_id }),

  resetPassword: (id: string, password: string, password_confirmation: string) =>
    api.post<ApiResponse<null>>(`/v1/users/${id}/reset-password`, { password, password_confirmation }),

  verify: (id: string, otp: string) =>
    api.post<ApiResponse<User>>(`/v1/users/${id}/verify`, { otp }),

  resendVerification: (id: string) =>
    api.post<ApiResponse<null>>(`/v1/users/${id}/resend-verification`),

  resendOtp: (id: string) =>
    api.post<ApiResponse<null>>(`/v1/users/${id}/resend-otp`),

  trashed: (params?: { search?: string; per_page?: number }) =>
    api.get<ApiResponse<PaginatedData<User>>>('/v1/users/trashed', { params }),

  restore: (id: string) =>
    api.patch<ApiResponse<null>>(`/v1/users/${id}/restore`),

  forceDelete: (id: string) =>
    api.delete<ApiResponse<null>>(`/v1/users/${id}/force`),

  stats: () =>
    api.get<ApiResponse<any>>('/v1/users/stats'),

  dropdown: (params?: { search?: string; active_only?: boolean }) =>
    api.get<ApiResponse<{ id: string; name: string }[]>>('/v1/users/dropdown', { params }),
};

// ---------- SHOP API ----------
export const shopApi = {
  index: (params?: { search?: string; status?: string; per_page?: number }) =>
    api.get<ApiResponse<PaginatedData<Shop>>>('/v5/shops', { params }),

  store: (data: ShopFormData) =>
    api.post<ApiResponse<Shop>>('/v5/shops', data),

  update: (id: string, data: Partial<ShopFormData>) =>
    api.put<ApiResponse<Shop>>(`/v5/shops/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v5/shops/${id}`),

  show: (id: string) =>
    api.get<ApiResponse<Shop>>(`/v5/shops/${id}`),

  restore: (id: string) =>
    api.patch<ApiResponse<Shop>>(`/v5/shops/${id}/restore`),

  forceDelete: (id: string) =>
    api.delete<ApiResponse<null>>(`/v5/shops/${id}/force`),

  changeStatus: (id: string, status: string) =>
    api.patch<ApiResponse<Shop>>(`/v5/shops/${id}/status`, { status }),

  dropdown: (params?: { active_only?: boolean }) =>
    api.get<ApiResponse<{ id: string; label: string }[]>>('/v5/shops/dropdown', { params }),
};

// ---------- AUDIT TRAIL API ----------
export const auditApi = {
  index: (params?: AuditTrailFilters & { page?: number }) =>
    api.get<ApiResponse<PaginatedData<AuditTrail>>>('/v1/audit-trails', { params }),

  getModules: () =>
    api.get<ApiResponse<string[]>>('/v1/audit-trails/modules'),

  getActions: () =>
    api.get<ApiResponse<string[]>>('/v1/audit-trails/actions'),

  getStats: (params?: Omit<AuditTrailFilters, 'per_page' | 'page'>) =>
    api.get<ApiResponse<AuditTrailStats>>('/v1/audit-trails/stats', { params }),

  exportCsv: (params?: AuditTrailFilters) =>
    api.get<Blob>('/v1/audit-trails/export/csv', { params, responseType: 'blob' }),

  exportExcel: (params?: AuditTrailFilters) =>
    api.get<Blob>('/v1/audit-trails/export/excel', { params, responseType: 'blob' }),

  exportPdf: (params?: AuditTrailFilters) =>
    api.get<Blob>('/v1/audit-trails/export/pdf', { params, responseType: 'blob' }),
};

// ---------- OTP API ----------
export const otpApi = {
  index: (params?: OTPFilters & { page?: number }) =>
    api.get<ApiResponse<{ data: PaginatedData<OTP>; stats: OTPStats }>>('/v1/otps', { params }),

  getStats: (params?: Omit<OTPFilters, 'per_page' | 'page'>) =>
    api.get<ApiResponse<OTPStats>>('/v1/otps/stats', { params }),

  cleanup: () =>
    api.delete<ApiResponse<{ deleted_count: number }>>('/v1/otps/cleanup'),

  cleanupUsed: () =>
    api.delete<ApiResponse<{ deleted_count: number }>>('/v1/otps/cleanup-used'),
};

// ---------- FAILED LOGIN ATTEMPTS API ----------
export const failedLoginApi = {
  index: (params?: FailedLoginFilters & { page?: number }) =>
    api.get<ApiResponse<{ data: PaginatedData<FailedLoginAttempt>; stats: FailedLoginStats }>>('/v1/auth', { params }),

  clear: (params?: { email?: string; ip_address?: string }) =>
    api.delete<ApiResponse<{ deleted_count: number }>>('/v1/auth/clear', { data: params }),

  block: (ip_address: string) =>
    api.post<ApiResponse<null>>('/v1/auth/block', { ip_address }),

  unblock: (ip_address: string) =>
    api.post<ApiResponse<null>>('/v1/auth/unblock', { ip_address }),
};

// ---------- COMPANY API ----------
export const companyApi = {
  index: (params?: CompanyFilters & { page?: number }) =>
    api.get<ApiResponse<PaginatedData<Company>>>('/v18/companies', { params }),

  store: (data: CompanyFormData) =>
    api.post<ApiResponse<Company>>('/v18/companies', data),

  update: (id: string, data: Partial<CompanyFormData>) =>
    api.put<ApiResponse<Company>>(`/v18/companies/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v18/companies/${id}`),

  show: (id: string) =>
    api.get<ApiResponse<Company>>(`/v18/companies/${id}`),

  restore: (id: string) =>
    api.patch<ApiResponse<Company>>(`/v18/companies/${id}/restore`),

  forceDelete: (id: string) =>
    api.delete<ApiResponse<null>>(`/v18/companies/${id}/force`),

  toggleStatus: (id: string) =>
    api.patch<ApiResponse<Company>>(`/v18/companies/${id}/toggle-status`),

  trashed: (params?: { search?: string; per_page?: number }) =>
    api.get<ApiResponse<PaginatedData<Company>>>('/v18/companies/trashed', { params }),

  stats: () =>
    api.get<ApiResponse<{ total: number; active: number; inactive: number; trashed: number }>>('/v18/companies/stats'),

  dropdown: (params?: { search?: string }) =>
    api.get<ApiResponse<{ id: string; label: string }[]>>('/v18/companies/dropdown', { params }),
};

// ---------- PRODUCT CATEGORY API ----------
export const categoryApi = {
  index: (params?: ProductCategoryFilters & { page?: number }) =>
    api.get<ApiResponse<PaginatedData<ProductCategory>>>('/v2/product-categories', { params }),

  store: (data: ProductCategoryFormData) =>
    api.post<ApiResponse<ProductCategory>>('/v2/product-categories', data),

  update: (id: string, data: Partial<ProductCategoryFormData>) =>
    api.put<ApiResponse<ProductCategory>>(`/v2/product-categories/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v2/product-categories/${id}`),

  show: (id: string) =>
    api.get<ApiResponse<ProductCategory>>(`/v2/product-categories/${id}`),

  activate: (id: string) =>
    api.patch<ApiResponse<ProductCategory>>(`/v2/product-categories/${id}/activate`),

  deactivate: (id: string) =>
    api.patch<ApiResponse<ProductCategory>>(`/v2/product-categories/${id}/deactivate`),

  toggleStatus: (id: string) =>
    api.patch<ApiResponse<ProductCategory>>(`/v2/product-categories/${id}/toggle-status`),

  dropdown: (params?: { search?: string; include_inactive?: boolean }) =>
    api.get<ApiResponse<{ value: string; label: string; name: string; code: string; skus: string[]; status: string }[]>>('/v2/product-categories/dropdown', { params }),
};

// ---------- PRODUCT API ----------
export const productApi = {
  index: (params?: ProductFilters) =>
    api.get<ApiResponse<PaginatedData<Product>>>('/v3/products', { params }),

  show: (id: string) =>
    api.get<ApiResponse<Product>>(`/v3/products/${id}`),

  store: (data: ProductFormData) =>
    api.post<ApiResponse<Product>>('/v3/products', data),

  update: (id: string, data: Partial<ProductFormData>) =>
    api.put<ApiResponse<Product>>(`/v3/products/${id}`, data),

  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v3/products/${id}`),

  restore: (id: string) =>
    api.patch<ApiResponse<Product>>(`/v3/products/${id}/restore`),

  forceDelete: (id: string) =>
    api.delete<ApiResponse<null>>(`/v3/products/${id}/force`),

  changeStatus: (id: string, status: string) =>
    api.patch<ApiResponse<Product>>(`/v3/products/${id}/status`, { status }),
};

// ---------- SALE API ----------
export const saleApi = {
  index: (params?: SaleFilters & { page?: number }) =>
    api.get<ApiResponse<PaginatedData<Sale>>>('/v1/sales', { params }),
  show: (id: string) =>
    api.get<ApiResponse<Sale>>(`/v1/sales/${id}`),
  store: (data: SaleFormData) =>
    api.post<ApiResponse<Sale>>('/v1/sales', data),
  update: (id: string, data: Partial<SaleFormData>) =>
    api.put<ApiResponse<Sale>>(`/v1/sales/${id}`, data),
  destroy: (id: string) =>
    api.delete<ApiResponse<null>>(`/v1/sales/${id}`),
  getStats: (params?: SaleFilters) =>
    api.get<ApiResponse<SaleStats>>('/v1/sales/stats', { params }),
};

// ---------- REPORT API ----------
export const reportApi = {
  sales: (params?: SalesReportFilters) =>
    api.get<ApiResponse<SalesReportData>>('/v19/reports/sales', { params }),
  stock: (params?: StockReportFilters) =>
    api.get<ApiResponse<StockReportData>>('/v19/reports/stock', { params }),
  returns: (params?: ReturnsReportFilters) =>
    api.get<ApiResponse<ReturnsReportData>>('/v19/reports/returns', { params }),
  exportSales: (params?: SalesReportFilters) =>
    api.get<Blob>('/v19/reports/sales/export', { params, responseType: 'blob' }),
  analysis: () => api.get<ApiResponse<any>>('/v19/reports/analysis'),
  agentsWithSales: (params?: any) => api.get<ApiResponse<any>>('/v19/reports/agents', { params }),
  shopsWithSales: (params?: any) => api.get<ApiResponse<any>>('/v19/reports/shops', { params }),
};
export type { User, Role };
