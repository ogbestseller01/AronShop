// src/components/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, Warehouse, Menu, ChevronLeft, ChevronRight, Globe, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, Language } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';

interface HeaderProps {
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onToggleSidebar, sidebarCollapsed, isMobile }) => {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitial = () => {
    if (!user || !user.name) return '?';
    return user.name.charAt(0).toUpperCase();
  };

  const languageLabels: Record<Language, string> = {
    sw: 'Swahili',
    en: 'English',
    zh: '中文',
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-2 flex flex-wrap items-center justify-between gap-2 relative z-30 overflow-visible">
      {/* Left: sidebar toggle + app name */}
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700">
          {isMobile ? (
            <Menu size={24} className="text-gray-700 dark:text-gray-300" />
          ) : (
            sidebarCollapsed ? (
              <ChevronRight size={24} className="text-gray-700 dark:text-gray-300" />
            ) : (
              <ChevronLeft size={24} className="text-gray-700 dark:text-gray-300" />
            )
          )}
        </button>
        <Warehouse className="text-orange-500" size={28} />
        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{t('app_name')}</span>
      </div>

      {/* Right: profile dropdown, language dropdown, theme toggle */}
      <div className="flex items-center gap-2 flex-wrap overflow-visible">
        {/* Profile Dropdown */}
        <div className="relative overflow-visible" ref={profileRef}>
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full px-2 py-1 transition"
          >
            {user && (
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold text-sm">
                {getInitial()}
              </div>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">{user?.name || ''}</span>
          </button>
          {profileDropdownOpen && (
            <div className={`absolute mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 ${isMobile ? 'left-0' : 'right-0'}`}>
              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  navigate('/profile');
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                <User size={16} />
                {t('profile')}
              </button>
              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400"
              >
                <LogOut size={16} />
                {t('logout')}
              </button>
            </div>
          )}
        </div>

        {/* Language Dropdown */}
        <div className="relative overflow-visible" ref={langRef}>
          <button
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
          >
            <Globe size={14} />
            {lang.toUpperCase()}
          </button>
          {langDropdownOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
              {(['sw', 'en', 'zh'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setLangDropdownOpen(false); }}
                  className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700 ${
                    lang === l
                      ? 'bg-orange-50 dark:bg-slate-700 text-orange-600 dark:text-orange-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {languageLabels[l]} ({l.toUpperCase()})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
};

export default Header;