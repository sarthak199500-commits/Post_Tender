import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import { isAxiosError } from 'axios';
import axiosInstance from '../api/axiosInstance';

/**
 * Self-service password change, available to every role.
 *
 * Reached either from the profile menu, or automatically after signing in with a
 * temporary password an admin issued (login returns `mustChangePassword`).
 */
export const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Mirrors the server's rule so the user is told before a round trip, not after.
  const MIN_LENGTH = 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < MIN_LENGTH) {
      setError(`Your new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from your current one.');
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post('/auth/change-password', { currentPassword, newPassword });
      setDone(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data
          ? err.response.data
          : 'Could not change your password. Please try again.'
      );
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-control p-8 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-emerald-900">Password changed</h1>
          <p className="text-sm text-emerald-800 mt-2">Taking you back to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
          <KeyRound className="w-7 h-7 text-brand-600" />
          Change Password
        </h1>
        <p className="text-slate-600 mt-2 text-sm">
          Choose a new password. You will need your current one to confirm it is you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-card border border-slate-200 shadow-sm p-6 space-y-5">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-card flex gap-3 text-sm font-medium">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label htmlFor="currentPassword" className="block text-sm font-bold text-slate-700 mb-2">Current password</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-bold text-slate-700 mb-2">New password</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 outline-none"
          />
          <p className="text-xs text-slate-600 mt-1">At least {MIN_LENGTH} characters. Longer is better than complicated.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700 mb-2">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-card font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-card font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
