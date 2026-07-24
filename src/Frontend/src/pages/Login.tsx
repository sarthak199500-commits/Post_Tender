import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials } from '../store/authSlice';
import logo from '../assets/logo.png';
import axiosInstance from '../api/axiosInstance';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showResetHelp, setShowResetHelp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axiosInstance.post('/auth/login', { email, password });

      const data = res.data;
      // setCredentials owns persistence — `remember` picks localStorage vs sessionStorage.
      dispatch(setCredentials({ user: data.user, token: data.token, remember }));

      if (data.user?.role === 'Admin' || data.user?.role === 'PMU') {
        navigate('/admin/dashboard');
      } else if (data.user?.role === 'Inspector') {
        navigate('/inspector/dashboard');
      } else if (data.user?.role === 'Department') {
        navigate('/department/dashboard');
      } else if (data.user?.role === 'Finance') {
        navigate('/finance/dashboard');
      } else {
        navigate('/vendor/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-white">
      {/* Left Side - Visual / Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 items-center justify-center p-12">
        <div className="relative z-10 text-white w-full max-w-lg">
          <div className="bg-white p-3 rounded-2xl shadow-xl w-40 mb-10 flex items-center justify-center">
            <img src={logo} alt="Logo" className="w-full h-auto object-contain" />
          </div>
          <h1 className="text-6xl font-black leading-tight mb-6 tracking-tight text-white">
            Enterprise Portal
          </h1>
          <p className="text-xl text-slate-400 font-medium">
            Securely manage your tender lifecycle, inspections, and project execution in one unified system.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <img src={logo} alt="Logo" className="w-48 md:w-64 mx-auto mb-6" />
          </div>

          <h2 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Login</h2>
          <p className="text-slate-700 mb-10 font-medium">Welcome back! Please login to your account.</p>

          {error && (
            <div className="p-4 mb-6 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">User Name</label>
              <input
                id="email"
                type="email"
                placeholder="username@example.com"
                className="w-full p-4 border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-700 focus:outline-none transition-all font-medium text-slate-900"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="w-full p-4 border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-700 focus:outline-none transition-all font-medium text-slate-900"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-5 h-5 rounded-lg border-slate-300 text-blue-700 focus:ring-blue-700 transition-all cursor-pointer"
                />
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Remember Me</span>
              </label>
              <button
                type="button"
                onClick={() => setShowResetHelp(v => !v)}
                aria-expanded={showResetHelp}
                className="text-sm font-bold text-slate-700 hover:text-blue-700 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* There is no self-service reset endpoint — accounts are provisioned and
                reset by an administrator, so say that rather than open a dead flow. */}
            {showResetHelp && (
              <div className="p-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl">
                Password resets are handled by your system administrator. Contact them to have
                your password reset — this portal has no self-service reset.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#004c8c] hover:bg-[#003d70] text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled: disabled:scale-100"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          {/* <div className="mt-12 text-center">
            <p className="text-sm font-bold text-slate-600">
              New User? <Link to="/signup" className="text-[#004c8c] hover:underline ml-1">Signup</Link>
            </p>
          </div> */}

          <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Test Credentials</h2>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Admin:</span>
                <code className="bg-white px-1 rounded border font-bold">admin@posttender.local / Admin@123</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Inspector:</span>
                <code className="bg-white px-1 rounded border font-bold">inspector@posttender.local / Inspector@123</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Finance:</span>
                <code className="bg-white px-1 rounded border font-bold">finance@posttender.local / Finance@123</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Department:</span>
                <code className="bg-white px-1 rounded border font-bold">department@posttender.local / Department@123</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Vendor:</span>
                <code className="bg-white px-1 rounded border font-bold">vendor@posttender.local / Vendor@123</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
