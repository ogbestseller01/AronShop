// ===== COMMON =====
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: any[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

// ===== AUTH =====
export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
}

export interface LoginResponse {
  user: User;
  role: Role | null;
  token: string;
  password_days_remaining: number;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  role_id: string;
}

export interface RegisterResponse {
  email: string;
  name: string;
  otp_sent: boolean;
  expires_in: number;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  user: User;
  role: Role | null;
  token: string;
  verified: boolean;
}

export interface ResendVerificationResponse {
  email: string;
  otp_sent: boolean;
  expires_in: number;
}

export interface ForgotPasswordResponse {
  email: string;
  otp_sent: boolean;
  expires_in: number;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  password: string;
  password_confirmation: string;
}

export interface MeResponse {
  user: User;
  role: Role | null;
  password_days_remaining: number;
}

// ===== USER =====
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  role_id: string;
  email_verified_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  role?: Role;
  createdBy?: User;
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string; // required for create
  phone?: string;
  role_id: string;
  status?: string; // for update
}

// ===== ROLE & PERMISSION =====
export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  guard_name: string;
  created_at: string;
  updated_at: string;
  users_count?: number;
  permissions?: Permission[];
}

export interface RoleFormData {
  name: string;
  display_name?: string;
  description?: string;
}

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  guard_name: string;
  created_at: string;
  updated_at: string;
  pivot?: { role_id: string; permission_id: string };
}

export interface PermissionFormData {
  name: string;
  display_name?: string;
  description?: string;
}

// ===== SHOP =====
export interface Shop {
  shop_id: string;
  name: string;
  location: string | null;
  manager_id: string | null;
  status: 'active' | 'inactive' | 'maintenance';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  manager?: User | null;
}

export interface ShopFormData {
  name: string;
  location?: string;
  manager_id?: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

// ===== Audit Trail =====
export interface AuditTrail {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  action_type: string | null;
  module: string | null;
  description: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_method: string | null;
  request_url: string | null;
  response_status: number | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface AuditTrailStats {
  total: number;
  by_module: Record<string, number>;
  by_action: Record<string, number>;
  by_user: Array<{ user_email: string; count: number }>;
  today: number;
  this_week: number;
}

export interface AuditTrailFilters {
  from_date?: string;
  to_date?: string;
  module?: string;
  action?: string;
  user_email?: string;
  search?: string;
  per_page?: number;
}


// ===== OTP =====
export interface OTP {
  id: string;
  email: string;
  otp: string;
  token: string;
  name: string | null;
  user_data: any;
  expires_at: string;
  is_used: boolean;
  type: 'registration' | 'password_reset' | 'email_verification' | 'login';
  ip_address: string | null;
  user_agent: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface OTPStats {
  total: number;
  used: number;
  unused: number;
  expired: number;
  by_type: Array<{ type: string; count: number }>;
}

export interface OTPFilters {
  email?: string;
  type?: string;
  is_used?: boolean;
  start_date?: string;
  end_date?: string;
  expired?: boolean;
  per_page?: number;
}

// ===== Failed Login Attempts =====
export interface FailedLoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  attempt_count: number;
  last_attempt_at: string;
}

export interface FailedLoginStats {
  total_records: number;
  unique_emails: number;
  unique_ips: number;
  blocked_ips: number;
  today_attempts: number;
}

export interface FailedLoginFilters {
  email?: string;
  ip_address?: string;
  start_date?: string;
  end_date?: string;
  min_attempts?: number;
  per_page?: number;
}

// ===== Company =====
export interface Company {
  id: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'active' | 'inactive';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  creator?: User | null;
}

export interface CompanyFormData {
  company_name: string;
  address?: string;
  phone?: string;
  email?: string;
  status?: 'active' | 'inactive';
}

export interface CompanyFilters {
  search?: string;
  status?: string;
  per_page?: number;
}

// ===== Product Category =====
export interface ProductCategory {
  category_id: string;
  category_name: string;
  model: string | null;
  sku: string[] | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryFormData {
  category_name: string;
  model?: string;
  sku?: string[];
  status?: 'active' | 'inactive';
}

export interface ProductCategoryFilters {
  search?: string;
  status?: string;
  per_page?: number;
}


// product.ts

export interface Product {
  product_id: string;
  category_id: string;
  sku: string;
  imei: string;
  shop_id?: string | null;
  buying_price: number;
  cash_selling_price?: number | null;
  loan_selling_price: ProductLoanPrice[];
  discounted_price?: number | null;
  status: ProductStatus;
  stock_status: ProductStockStatus;
  condition?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Relations
  category?: ProductCategory;
  shop?: Shop;
}

export interface ProductCategory {
  category_id: string;
  category_name: string;
  model?: string;
  sku?: string[];
}

export interface Shop {
  shop_id: string;
  shop_name: string;
}

export interface ProductLoanPrice {
  company_id: string;
  price: number;
}

export interface Company {
  id: string;
  company_name: string;
}

export type ProductStatus = 'active' | 'inactive' | 'sold' | 'returned';
export type ProductStockStatus = 'in_stock' | 'transferred' | 'received' | 'sold' | 'damaged' | 'pending_return' | 'returned';

export interface ProductFormData {
  category_id: string;
  sku: string;
  imeis?: string; // bulk create: comma/space separated list
  imei?: string;  // single update
  buying_price?: number | null;
  cash_selling_price?: number | null;
  loan_selling_price?: ProductLoanPrice[];
  status?: ProductStatus;
  shop_id?: string | null;
}

export interface ProductFilters {
  category_id?: string;
  shop_id?: string;
  status?: ProductStatus;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  sold: number;
  damaged: number;
  in_stock: number;
}


// ===== SALE =====
export interface Sale {
  sale_id: string;
  agent_id: string;
  product_id: string;
  total_amount: number;
  payment_method: 'cash' | 'loan' | 'mpesa' | 'bank';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  agent?: User;
  product?: Product;
  customer?: Customer;
  company?: Company;

}

export interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleFilters {
  status?: string;
  agent_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface SaleStats {
  total: number;
  total_amount: number;
  by_status: Record<string, number>;
  by_payment_method: Record<string, number>;
}

export interface SaleFormData {
  agent_id: string;
  product_id: string;
  total_amount: number;
  payment_method: 'cash' | 'loan' | 'mpesa' | 'bank';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes?: string;
}


// ===== REPORTS =====
export interface SalesReportFilters {
  from_date?: string;
  to_date?: string;
  shop_id?: string;
  agent_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export interface SalesReportData {
  data: PaginatedData<Sale>;
  summary: {
    total_sales: number;
    total_revenue: number;
    avg_order_value: number;
    by_payment_method: Record<string, number>;
  };
}

export interface StockReportFilters {
  shop_id?: string;
  category_id?: string;
  stock_status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface StockReportData {
  data: PaginatedData<Product>;
  summary: {
    total_products: number;
    in_stock: number;
    sold: number;
    returned: number;
    damaged: number;
    by_category: Record<string, number>;
  };
}

export interface ReturnsReportFilters {
  shop_id?: string;
  category_id?: string;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ReturnsReportData {
  data: PaginatedData<Product>;
  summary: {
    total_returned: number;
    pending_return: number;
    by_category: Record<string, number>;
  };
}