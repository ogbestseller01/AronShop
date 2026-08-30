// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { userApi, roleApi } from '../../services/api';
import { User, UserFormData, Role } from '../../types';
import toast from 'react-hot-toast';
import {
  Edit,
  Trash2,
  X,
  MoreVertical,
  UserCheck,
  UserX,
  UserCog,
  Key,
  Send,
  Shield,
  RefreshCw,
  Plus,
} from 'lucide-react'; // ✅ added Plus
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';

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
    const arr = value.split('').slice(0, 6);
    while (arr.length < 6) arr.push('');
    return arr;
  });

  useEffect(() => {
    const arr = value.split('').slice(0, 6);
    while (arr.length < 6) arr.push('');
    setOtpArray(arr);
  }, [value]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;
    const newOtp = [...otpArray];
    newOtp[index] = digit.slice(0, 1);
    setOtpArray(newOtp);
    onChange(newOtp.join(''));
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
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

// ========== MAIN USERS PAGE ==========

const getStatusBadge = (status: string) => {
  const map: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'orange'> = {
    active: 'green',
    pending: 'yellow',
    suspended: 'red',
    inactive: 'gray',
  };
  return map[status] || 'gray';
};

const getStatusLabel = (status: string, t: any) => {
  const map: Record<string, string> = {
    active: t('active'),
    pending: t('pending'),
    suspended: t('suspended'),
    inactive: t('inactive'),
  };
  return map[status] || status;
};

// Country codes
const COUNTRY_CODES = [
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+256', label: 'Uganda (+256)' },
];

const UsersPage: React.FC = () => {
  const { t } = useLanguage(); // ✅ keep as t
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true); // ✅ keep as setLoading
  const [search, setSearch] = useState(''); // ✅ keep as setSearch
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    phone: '',
    role_id: '',
    password: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone split state
  const [selectedPrefix, setSelectedPrefix] = useState(COUNTRY_CODES[0].code);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Password reset form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP verification
  const [otpCode, setOtpCode] = useState('');
  const [verifyUserId, setVerifyUserId] = useState<string | null>(null);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Permissions
  const canCreate = hasPermission('users.create');
  const canEdit = hasPermission('users.edit');
  const canDelete = hasPermission('users.delete');
  const canActivate = hasPermission('users.activate');
  const canDeactivate = hasPermission('users.deactivate');
  const canSuspend = hasPermission('users.suspend');
  const canAssignRole = hasPermission('users.assign_role');
  const canResetPassword = hasPermission('users.reset_password');

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await roleApi.getDropdown();
        setRoles(res.data.data || []);
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to fetch roles';
        toast.error(msg);
      }
    };
    fetchRoles();
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.index({ search, per_page: 1000 });
      setUsers(res.data.data.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch users';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Handlers ----
  const handleOpenModal = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role_id: user.role_id,
        status: user.status,
      });
      if (user.phone) {
        const matched = COUNTRY_CODES.find((c) => user.phone?.startsWith(c.code));
        if (matched) {
          setSelectedPrefix(matched.code);
          setPhoneNumber(user.phone.replace(matched.code, ''));
        } else {
          setSelectedPrefix(COUNTRY_CODES[0].code);
          setPhoneNumber(user.phone);
        }
      } else {
        setSelectedPrefix(COUNTRY_CODES[0].code);
        setPhoneNumber('');
      }
    } else {
      setSelectedUser(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role_id: '',
        password: '',
      });
      setSelectedPrefix(COUNTRY_CODES[0].code);
      setPhoneNumber('');
    }
    setIsModalOpen(true);
    setDropdownOpen(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const getFullPhone = () => {
    if (!phoneNumber) return '';
    const cleaned = phoneNumber.replace(/^0+/, '');
    return selectedPrefix + cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = getFullPhone();
    if (!fullPhone) {
      toast.error('Please enter a valid phone number');
      return;
    }
    const submitData = { ...formData };
    if (!selectedUser) {
      submitData.password = '12345678';
    }
    submitData.phone = fullPhone;

    setIsSubmitting(true);

    try {
      if (selectedUser) {
        await userApi.update(selectedUser.id, submitData);
        toast.success('User updated successfully');
      } else {
        await userApi.store(submitData);
        toast.success('User created successfully. OTP sent to their email.');
      }
      fetchUsers();
      handleCloseModal();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await userApi.destroy(selectedUser.id);
      toast.success('User deleted successfully');
      fetchUsers();
      setIsDeleteModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete user';
      toast.error(msg);
    }
  };

  const handleActivate = async (user: User) => {
    try {
      await userApi.activate(user.id);
      toast.success('User activated');
      fetchUsers();
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to activate user';
      toast.error(msg);
    }
  };

  const handleDeactivate = async (user: User) => {
    try {
      await userApi.deactivate(user.id);
      toast.success('User deactivated');
      fetchUsers();
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to deactivate user';
      toast.error(msg);
    }
  };

  const handleSuspend = async (user: User) => {
    try {
      await userApi.suspend(user.id);
      toast.success('User suspended');
      fetchUsers();
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to suspend user';
      toast.error(msg);
    }
  };

  const handleAssignRole = async (roleId: string) => {
    if (!selectedUser) return;
    try {
      await userApi.assignRole(selectedUser.id, roleId);
      toast.success('Role assigned successfully');
      fetchUsers();
      setIsRoleModalOpen(false);
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to assign role';
      toast.error(msg);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await userApi.resetPassword(selectedUser.id, newPassword, confirmPassword);
      toast.success('Password reset successfully');
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password';
      toast.error(msg);
    }
  };

  const handleVerifyNow = (user: User) => {
    setVerifyUserId(user.id);
    setOtpCode('');
    setIsOtpModalOpen(true);
    setDropdownOpen(null);
  };

  const handleOtpSubmit = async () => {
    if (!verifyUserId || otpCode.length < 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }
    try {
      await userApi.verify(verifyUserId, otpCode);
      toast.success('User verified successfully');
      fetchUsers();
      setIsOtpModalOpen(false);
      setOtpCode('');
      setVerifyUserId(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to verify user';
      toast.error(msg);
    }
  };

  const handleResendOtp = async (user: User) => {
    try {
      await userApi.resendOtp(user.id);
      toast.success('OTP resent successfully');
      setDropdownOpen(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend OTP';
      toast.error(msg);
    }
  };

  // Columns
  const columns = [
    { key: 'name', label: t('name_col') },
    { key: 'email', label: t('email_col') },
    {
      key: 'phone',
      label: t('phone_col'),
      render: (item: User) => item.phone || '—',
    },
    {
      key: 'role',
      label: t('role_col'),
      render: (item: User) => item.role?.display_name || '—',
    },
    {
      key: 'status',
      label: t('status_col'),
      render: (item: User) => (
        <Badge tone={getStatusBadge(item.status)}>
          {getStatusLabel(item.status, t)}
        </Badge>
      ),
    },
    {
      key: 'email_verified_at',
      label: t('verified_col'),
      render: (item: User) =>
        item.email_verified_at ? (
          <Badge tone="green">{t('verified')}</Badge>
        ) : (
          <Badge tone="red">{t('pending')}</Badge>
        ),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (item: User) => (
        <div className="relative" ref={dropdownOpen === item.id ? dropdownRef : null}>
          <button
            onClick={() => setDropdownOpen(dropdownOpen === item.id ? null : item.id)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <MoreVertical size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          {dropdownOpen === item.id && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 max-h-80 overflow-y-auto">
              {canEdit && (
                <button
                  onClick={() => handleOpenModal(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition"
                >
                  <Edit size={16} className="text-orange-500" />
                  {t('edit')}
                </button>
              )}
              {canActivate && item.status !== 'active' && (
                <button
                  onClick={() => handleActivate(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-green-600 dark:text-green-400 transition"
                >
                  <UserCheck size={16} />
                  {t('activate')}
                </button>
              )}
              {canDeactivate && item.status === 'active' && (
                <button
                  onClick={() => handleDeactivate(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition"
                >
                  <UserX size={16} />
                  {t('deactivate')}
                </button>
              )}
              {canSuspend && item.status !== 'suspended' && (
                <button
                  onClick={() => handleSuspend(item)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                >
                  <UserCog size={16} />
                  {t('suspend')}
                </button>
              )}
              {canAssignRole && (
                <button
                  onClick={() => { setSelectedUser(item); setIsRoleModalOpen(true); setDropdownOpen(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 transition"
                >
                  <Shield size={16} />
                  {t('assign_role')}
                </button>
              )}
              {canResetPassword && (
                <button
                  onClick={() => { setSelectedUser(item); setIsPasswordModalOpen(true); setDropdownOpen(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 transition"
                >
                  <Key size={16} />
                  {t('reset_password')}
                </button>
              )}
              {!item.email_verified_at && (
                <>
                  <button
                    onClick={() => handleVerifyNow(item)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-teal-600 dark:text-teal-400 transition"
                  >
                    <UserCheck size={16} />
                    {t('verify_now')}
                  </button>
                  <button
                    onClick={() => handleResendOtp(item)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-yellow-600 dark:text-yellow-400 transition"
                  >
                    <Send size={16} />
                    {t('resend_otp')}
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  onClick={() => { setSelectedUser(item); setIsDeleteModalOpen(true); setDropdownOpen(null); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 transition"
                >
                  <Trash2 size={16} />
                  {t('delete')}
                </button>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 py-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('users_title')}</h1>
        {canCreate && (
          <button
            onClick={() => handleOpenModal()}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-2 md:px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition shadow-md"
          >
            <Plus size={16} />
            {t('add_user')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          title=""
          columns={columns}
          data={loading ? [] : users}
          itemsPerPage={10}
          onRefresh={fetchUsers}
        />
      </div>

      {/* ===== CREATE/EDIT MODAL ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedUser ? t('edit_user') : t('create_user')}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('full_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('email')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                  disabled={!!selectedUser}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('phone')}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedPrefix}
                    onChange={(e) => setSelectedPrefix(e.target.value)}
                    className="w-1/3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      val = val.replace(/^0+/, '');
                      if (val.length > 9) val = val.slice(0, 9);
                      setPhoneNumber(val);
                    }}
                    placeholder="e.g. 768798987"
                    maxLength={9}
                    className="w-2/3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('role')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                >
                  <option value="">{t('select_role')}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.display_name || role.name}
                    </option>
                  ))}
                </select>
              </div>
              {!selectedUser && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('default_password')}: 12345678
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {selectedUser ? t('updating') : t('creating')}
                    </>
                  ) : (
                    selectedUser ? t('update') : t('create')
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-6 shadow-lg">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('delete_user')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('delete_user_confirm', { name: selectedUser.name })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ASSIGN ROLE MODAL ===== */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('assign_role_to')}: {selectedUser.name}
              </h3>
              <button
                onClick={() => { setIsRoleModalOpen(false); setSelectedUser(null); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleAssignRole(role.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition ${
                    selectedUser.role_id === role.id
                      ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800'
                      : ''
                  }`}
                >
                  {role.display_name || role.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== RESET PASSWORD MODAL ===== */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('reset_password_for')}: {selectedUser.name}
              </h3>
              <button
                onClick={() => { setIsPasswordModalOpen(false); setSelectedUser(null); setNewPassword(''); setConfirmPassword(''); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('new_password')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">
                  {t('confirm_password')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                  minLength={8}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-medium"
                >
                  {t('reset_password')}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPasswordModalOpen(false); setNewPassword(''); setConfirmPassword(''); }}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== OTP VERIFICATION MODAL (with box input) ===== */}
      {isOtpModalOpen && verifyUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {t('verify_user')}
              </h3>
              <button
                onClick={() => { setIsOtpModalOpen(false); setVerifyUserId(null); setOtpCode(''); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('enter_otp_sent')} <strong>{users.find(u => u.id === verifyUserId)?.email}</strong>
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleOtpSubmit(); }} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300 block mb-2">
                  {t('otp_code')} <span className="text-red-500">*</span>
                </label>
                <OtpInput value={otpCode} onChange={setOtpCode} autoFocus />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-medium"
                >
                  {t('verify')}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsOtpModalOpen(false); setVerifyUserId(null); setOtpCode(''); }}
                  className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg py-2 text-sm font-medium"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;