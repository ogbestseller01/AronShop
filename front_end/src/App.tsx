// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import LoginScreen from './pages/Auth/LoginScreen';
import ProtectedRoute from './components/ProtectedRoute';

// Page imports
import DashboardOverview from './pages/DashboardOverview';
import UsersPage from './pages/Users/UsersPage';
import ShopsPage from './pages/Shops/ShopsPage';
import ProductsPage from './pages/Products/ProductsPage';
import SalesPage from './pages/Sales/SalesPage';
import SalesHistoryPage from './pages/Sales/SalesHistoryPage';
import ReportsPage from './pages/Reports/ReportsPage';
import AnalysisPage from './pages/Analysis/AnalysisPage';
import RolesPage from './pages/Roles/RolesPage';
import PermissionsPage from './pages/Permissions/PermissionsPage';
import AuditTrailPage from './pages/Audit/AuditTrailPage';
import OTPPage from './pages/OTP/OTPPage';
import FailedLoginPage from './pages/FailedLogins/FailedLoginPage';
import CompaniesPage from './pages/Companies/CompaniesPage';
import CategoriesPage from './pages/Categories/CategoriesPage';
import ProfilePage from './pages/Auth/ProfilePage';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <Toaster position="top-right" />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/" element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route index element={<DashboardOverview />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="shops" element={<ShopsPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="sales" element={<SalesPage />} />
                    <Route path="sales-history" element={<SalesHistoryPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="analysis" element={<AnalysisPage />} />
                    <Route path="roles" element={<RolesPage />} />
                    <Route path="permissions" element={<PermissionsPage />} />
                    <Route path="audit" element={<AuditTrailPage />} />
                    <Route path="otp" element={<OTPPage />} />
                    <Route path="failed-logins" element={<FailedLoginPage />} />
                    <Route path="companies" element={<CompaniesPage />} />
                    <Route path="categories" element={<CategoriesPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;