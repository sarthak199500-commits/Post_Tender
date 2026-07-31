import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, ShieldCheck, KeyRound } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  mustChangePassword?: boolean;
}

// Role → badge tint. A role is a category, not a state, but each needs to stay
// tellable apart at a glance, so these are four distinct tones from the palette.
const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-brand-100 text-brand-700',
  PMU: 'bg-slate-100 text-slate-600',
  Finance: 'bg-emerald-100 text-emerald-700',
  Department: 'bg-amber-100 text-amber-700',
};

export const InternalUsersList = () => {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get<InternalUser[]>('/auth/users');
      setUsers(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // There is no mail sender in this system, so the temporary password comes back in the
  // response for the admin to pass on directly. It is shown once and never retrievable.
  const handleReset = async (user: InternalUser) => {
    if (!window.confirm(`Reset the password for ${user.name}? Their current password stops working immediately.`)) return;
    setResettingId(user.id);
    try {
      const { data } = await axiosInstance.post<{ temporaryPassword: string }>(`/auth/users/${user.id}/reset-password`);
      window.prompt(
        `Temporary password for ${user.name}. Copy it now — it cannot be shown again. ` +
        'They will be asked to change it after signing in.',
        data.temporaryPassword
      );
      await load();
    } catch {
      alert('Failed to reset the password. Please try again.');
    } finally {
      setResettingId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const filtered = users.filter(u =>
    !term ||
    u.name.toLowerCase().includes(term) ||
    u.email.toLowerCase().includes(term) ||
    u.role.toLowerCase().includes(term)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-brand-600" />
            Internal Users
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Staff accounts for Admin, PMU, Finance and Department teams.</p>
        </div>
        <Link
          to="/admin/masters/users/add"
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-card font-bold flex items-center gap-2 shadow-lg shadow-brand-200 transition-colors self-start"
        >
          <UserPlus className="w-4 h-4" /> Add Internal User
        </Link>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            All Users {!loading && !error && <span className="text-slate-400 font-semibold text-sm">({filtered.length})</span>}
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, email, role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-control text-sm focus:ring-2 focus:ring-brand-500 outline-none w-full sm:w-72 bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center text-slate-500 py-10 font-medium">Loading users…</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="text-center text-red-600 py-10 font-medium">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-500 py-10 font-medium">
                  {users.length === 0 ? 'No internal users yet. Add one to get started.' : 'No users match your search.'}
                </td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-control bg-gradient-to-br from-brand-500 to-brand-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{u.email}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {(u.role === 'Admin' || u.role === 'PMU') && <ShieldCheck className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500 font-medium">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {u.mustChangePassword && (
                        <span className="ml-2 inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider">
                          Reset pending
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleReset(u)}
                        disabled={resettingId !== null}
                        className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 text-xs font-bold px-3 py-1.5 rounded-control transition-colors disabled:opacity-50"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {resettingId === u.id ? 'Resetting…' : 'Reset Password'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
