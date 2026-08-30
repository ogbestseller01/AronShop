import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Eye, EyeOff, ArrowLeft, Globe, Sun, Moon, Warehouse } from "lucide-react";
import { FaGoogle, FaApple } from "react-icons/fa";
import { useLanguage, Language } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import toast from 'react-hot-toast';
import Footer from "../../components/Footer";

// ========== MODE TYPES ==========
type Mode = 'login' | 'verify-otp' | 'forgot' | 'reset-password';

// ========== OTP INPUT COMPONENT ==========
interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled = false, autoFocus = false }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpArray, setOtpArray] = useState<string[]>(() => {
    // Initialize from value prop
    const arr = value.split('').slice(0, 6);
    while (arr.length < 6) arr.push('');
    return arr;
  });

  // Sync with external value changes
  useEffect(() => {
    const arr = value.split('').slice(0, 6);
    while (arr.length < 6) arr.push('');
    setOtpArray(arr);
  }, [value]);

  const handleChange = (index: number, digit: string) => {
    // Only allow digits
    if (!/^\d*$/.test(digit)) return;

    const newOtp = [...otpArray];
    newOtp[index] = digit.slice(0, 1);
    setOtpArray(newOtp);
    onChange(newOtp.join(''));

    // Auto-advance to next input if digit entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      // Move to previous input on backspace when current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const digits = pasted.split('');
      const newOtp = [...otpArray];
      for (let i = 0; i < Math.min(digits.length, 6); i++) {
        newOtp[i] = digits[i];
      }
      setOtpArray(newOtp);
      onChange(newOtp.join(''));
      // Focus the next empty field or the last filled
      const nextEmpty = newOtp.findIndex(d => d === '');
      const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
      inputRefs.current[focusIndex]?.focus();
    }
  };

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  return (
    <div className="flex gap-2 justify-center">
      {otpArray.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
        />
      ))}
    </div>
  );
};

// ========== MAIN LOGIN SCREEN ==========
export default function LoginScreen() {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const {
    login,
    verifyOTP,
    resendVerification,
    forgotPassword,
    resetPassword,
    isLoading,
    user,
  } = useAuth();

  // ========== REDIRECT IF ALREADY AUTHENTICATED ==========
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // ========== LANGUAGE DROPDOWN ==========
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languageLabels: Record<Language, string> = {
    sw: 'Swahili',
    en: 'English',
    zh: '中文',
  };

  // ========== LOGIN STATE ==========
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ========== OTP VERIFICATION STATE ==========
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  // ========== FORGOT PASSWORD STATE ==========
  const [resetEmail, setResetEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // ========== RESET PASSWORD STATE ==========
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  // ========== CURRENT MODE ==========
  const [mode, setMode] = useState<Mode>('login');

  // ========== HANDLERS ==========

  // --- Login ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login(email, password);
      toast.success(response?.message || "Login successful");
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  };

  // --- OTP Verification ---
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      toast.error("Please enter the complete 6-digit OTP.");
      return;
    }
    try {
      const response = await verifyOTP(otpEmail, otp);
      toast.success(response?.message || "Email verified successfully");
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || "OTP verification failed");
    }
  };

  const handleResendOTP = async () => {
    try {
      const response = await resendVerification(otpEmail);
      toast.success(response?.message || "New OTP sent to your email.");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend OTP");
    }
  };

  // --- Forgot Password ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const response = await forgotPassword(resetEmail);
      toast.success(response?.message || "Password reset OTP sent to your email.");
      setMode('reset-password');
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setForgotLoading(false);
    }
  };

  // --- Reset Password ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetOtp.length < 6) {
      toast.error("Please enter the complete 6-digit OTP.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      const response = await resetPassword(resetEmail, resetOtp, newPassword);
      toast.success(response?.message || "Password reset successfully.");
      setTimeout(() => {
        setMode('login');
        setResetEmail("");
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
        navigate('/');
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Password reset failed");
    }
  };

  // --- Social Login (placeholder) ---
  const handleSocialLogin = (provider: 'google' | 'apple') => {
    toast("Social login not implemented yet.", { icon: 'ℹ️' });
  };

  // ========== RENDER FUNCTIONS ==========

  // ----- LOGIN FORM -----
  const renderLogin = () => (
    <>
      <form onSubmit={handleLogin} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('password')}</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2 text-sm font-medium"
        >
          {isLoading ? t('loading') : t('login')}
        </button>
      </form>

      <div className="mt-3 flex flex-col items-end gap-1">
        <button onClick={() => setMode('forgot')} className="text-xs text-orange-500 hover:underline dark:text-orange-400">
          {t('forgot_password')}
        </button>
      </div>

      <div className="mt-4">
        <div className="relative flex items-center">
          <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
          <span className="mx-2 text-xs text-gray-500 dark:text-gray-400">{t('or_continue_with')}</span>
          <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSocialLogin('google')}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600"
          >
            <FaGoogle className="w-5 h-5 text-red-500" />
            <span>{t('signin_google')}</span>
          </button>
          <button
            onClick={() => handleSocialLogin('apple')}
            className="flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black border border-gray-300 dark:border-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <FaApple className="w-5 h-5" />
            <span>{t('signin_apple')}</span>
          </button>
        </div>
      </div>
    </>
  );

  // ----- OTP VERIFICATION FORM (with box input) -----
  const renderVerifyOTP = () => (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setMode('login')} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('verify_otp_title')}</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {t('enter_otp_sent')} <strong>{otpEmail}</strong>
      </p>
      <form onSubmit={handleVerifyOTP} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-2">{t('otp_code')}</label>
          <OtpInput value={otp} onChange={setOtp} autoFocus />
        </div>
        <button type="submit" disabled={isLoading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2 text-sm font-medium">
          {isLoading ? t('loading') : t('verify')}
        </button>
      </form>
      <button onClick={handleResendOTP} className="text-xs text-orange-500 hover:underline dark:text-orange-400">
        {t('resend_otp')}
      </button>
    </div>
  );

  // ----- FORGOT PASSWORD FORM -----
  const renderForgotPassword = () => (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setMode('login')} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('reset_password')}</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('enter_email_reset')}</p>
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('email')}</label>
          <input
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="Enter mail"
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <button type="submit" disabled={forgotLoading || isLoading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2 text-sm font-medium">
          {forgotLoading ? t('loading') : t('send_reset_link')}
        </button>
      </form>
    </div>
  );

  // ----- RESET PASSWORD FORM (with box input) -----
  const renderResetPassword = () => (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setMode('login')} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('reset_password')}</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('enter_otp_and_new_password')}</p>
      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-2">{t('otp_code')}</label>
          <OtpInput value={resetOtp} onChange={setResetOtp} autoFocus />
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('new_password')}</label>
          <div className="relative">
            <input
              type={showResetPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowResetPassword(!showResetPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">{t('confirm_password')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <button type="submit" disabled={isLoading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white rounded-lg py-2 text-sm font-medium">
          {isLoading ? t('loading') : t('reset_password')}
        </button>
      </form>
    </div>
  );

  // ========== MAIN RENDER ==========
  return (
    <div className="h-screen w-full overflow-hidden bg-gray-50 dark:bg-slate-900 flex flex-col">
      <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="text-orange-500" size={24} />
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{t('app_name')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={langRef}>
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

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-sm flex flex-col">
          <div className="flex items-center gap-2 justify-center mb-6">
            <Package className="text-orange-500" size={28} />
            <span className="text-xl font-semibold text-slate-800 dark:text-white">INVENTORY MANAGEMENT</span>
          </div>

          {mode === 'login' && renderLogin()}
          {mode === 'verify-otp' && renderVerifyOTP()}
          {mode === 'forgot' && renderForgotPassword()}
          {mode === 'reset-password' && renderResetPassword()}
        </div>
      </div>
      <Footer />
    </div>
  );
}