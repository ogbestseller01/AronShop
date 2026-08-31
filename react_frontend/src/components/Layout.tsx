// src/components/Layout.tsx
import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function Layout() {
  const { logout } = useAuth(); // only keep what's used
  const navigate = useNavigate();
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
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
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
          collapsed={sidebarCollapsed}
          isMobile={isMobile}
          onClose={() => setSidebarCollapsed(true)}
        />

        <div
          className="flex-1 flex flex-col transition-all duration-300 overflow-hidden"
          style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        >
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}