import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Save, ArrowLeft } from 'lucide-react';
import type { RootState } from '../../store';

export const AddInternalUser = () => {
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Department',
    departmentId: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5249/api/auth/register-internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert('User created successfully!');
        navigate('/admin/dashboard');
      } else {
        const errorText = await res.text();
        alert(`Failed to create user: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-8">
        <button 
          onClick={() => navigate('/admin/dashboard')}
          className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1"
        >
          &larr; Back to Dashboard
        </button>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-indigo-600" />
            Add Internal User
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Provision accounts for Department heads and Finance team members.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Full Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Temporary Password</label>
              <input 
                type="text" 
                required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                placeholder="SecurePass123!"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">User Role</label>
                <select aria-label="Select an option" 
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                >
                  <option value="Department">Department</option>
                  <option value="Finance">Finance</option>
                  <option value="PMU">PMU</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {formData.role === 'Department' && (
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Department ID</label>
                  <input 
                    type="text"
                    value={formData.departmentId}
                    onChange={e => setFormData({...formData, departmentId: e.target.value})}
                    className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                    placeholder="e.g. Civil"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 disabled:"
            >
              {loading ? 'Creating...' : <><Save className="w-5 h-5" /> Provision User</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
