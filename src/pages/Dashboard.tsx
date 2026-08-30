// @ts-nocheck
// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DashboardOverview from './DashboardOverview';
import ProfilePage from './Auth/ProfilePage';
import RolesPage from './Roles/RolesPage';
import PermissionsPage from './Permissions/PermissionsPage';
import UsersPage from './Users/UsersPage';
import ShopsPage from './Shops/ShopsPage';
import AuditTrailPage from './Audit/AuditTrailPage';
import OTPPage from './OTP/OTPPage';
import FailedLoginPage from './FailedLogins/FailedLoginPage';
import CompaniesPage from './Companies/CompaniesPage';
import CategoriesPage from './Categories/CategoriesPage';
import ProductsPage from './Products/ProductsPage';
import SalesPage from './Sales/SalesPage';
import SalesHistoryPage from './Sales/SalesHistoryPage';
import ReportsPage from './Reports/ReportsPage';
import AnalysisPage from './Analysis/AnalysisPage'; // ✅ NEW

// Map pages to required permissions
const PAGE_PERMISSIONS: Record<string, string> = {
  overview: 'dashboard.main.view',
  users: 'users.view',
  shops: 'warehouses.view',
  revenue: 'reports.sales.view',
  shop: 'shop.view',
  roles: 'roles.view',
  permissions: 'permissions.view',
  audit: 'audit.view',
  otp: 'otp.view',
  failed_logins: 'failed_logins.view',
  companies: 'companies.view',
  categories: 'categories.view',
  products: 'products.view',
  sales: 'sales.view',
  sales_history: 'sales.view',
  reports: 'reports.view',
  analysis: 'reports.sales.view',
  profile: '',
};

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth();
  const { t } = useLanguage();
  const [active, setActive] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  const handleLogout = async () => {
    try {
      const response = await logout();
      toast.success(response?.message || 'Logged out successfully');
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
    }
  };

  const renderContent = () => {
    const requiredPermission = PAGE_PERMISSIONS[active];
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center max-w-md">
            <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
              Access Denied
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300 mt-2">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      );
    }

    switch (active) {
      case 'profile':
        return <ProfilePage />;
      case 'overview':
        return <DashboardOverview />;
      case 'roles':
        return <RolesPage />;
      case 'permissions':
        return <PermissionsPage />;
      case 'users':
        return <UsersPage />;
      case 'shops':
        return <ShopsPage />;
      case 'audit':
        return <AuditTrailPage />;
      case 'otp':
        return <OTPPage />;
      case 'failed_logins':
        return <FailedLoginPage />;
      case 'companies':
        return <CompaniesPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'products':
        return <ProductsPage />;
      case 'sales':
        return <SalesPage setActive={setActive} />;
      case 'sales_history':
        return <SalesHistoryPage />;
      case 'reports':
        return <ReportsPage />;
      case 'analysis': // ✅ NEW
        return <AnalysisPage />;
      default:
        return (
          <div className="p-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Page not found
            </h2>
          </div>
        );
    }
  };

  const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 64 : 224;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-gray-50 dark:bg-slate-900">
      <Header
        onLogout={handleLogout}
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        isMobile={isMobile}
        
      />

      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar
          
          setActive={setActive}
          onLogout={handleLogout}
          name={user?.name || ''}
          collapsed={sidebarCollapsed}
          isMobile={isMobile}
          onClose={() => setSidebarCollapsed(true)}
        />

        <div
          className="flex-1 flex flex-col transition-all duration-300 overflow-hidden"
          style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        >
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {renderContent()}
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}