import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';

interface Category {
  id: string;
  name: string;
}

export const AddVendor = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    gstNo: '',
    yearOfIncorporation: '',
    authPersonName: '',
    mobile: '',
    alternativeNumber: '',
    email: '',
    categoryId: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get<Category[]>('/vendorcategories');
        setCategories(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();
  }, []);

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        yearOfIncorporation: formData.yearOfIncorporation ? parseInt(formData.yearOfIncorporation) : null,
      };

      await axiosInstance.post('/vendors', payload);

      setSuccess(true);
      setTimeout(() => navigate('/vendors'), 2000);
    } catch (err) {
      if (isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data) {
        setError(err.response.data);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add vendor');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-2';

  return (
    <div className="p-8 max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/vendors')}
          className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1"
        >
          &larr; Back to Directory
        </button>
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Add Vendor</h2>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Row 1: Company Name + GST */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Company Name</label>
              <input type="text" className={inputCls} placeholder="e.g. Infratech Solutions Pvt Ltd"
                value={formData.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>GST No.</label>
              <input type="text" className={inputCls} placeholder="e.g. 22ABCDE1234F1Z5"
                value={formData.gstNo} onChange={e => set('gstNo', e.target.value)} />
            </div>
          </div>

          {/* Row 2: Year of Incorporation + Category */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Year of Incorporation</label>
              <input type="number" className={inputCls} placeholder="e.g. 2010"
                min="1900" max={new Date().getFullYear()}
                value={formData.yearOfIncorporation} onChange={e => set('yearOfIncorporation', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select aria-label="Select an option" className={inputCls}
                value={formData.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Auth Person Name */}
          <div>
            <label className={labelCls}>Authorized Person Name</label>
            <input type="text" className={inputCls} placeholder="Full name of the authorized signatory"
              value={formData.authPersonName} onChange={e => set('authPersonName', e.target.value)} required />
          </div>

          {/* Row 4: Mobile + Alternative Number */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Mobile</label>
              <input type="tel" className={inputCls} placeholder="e.g. 9876543210"
                value={formData.mobile} onChange={e => set('mobile', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Alternative Number</label>
              <input type="tel" className={inputCls} placeholder="Optional"
                value={formData.alternativeNumber} onChange={e => set('alternativeNumber', e.target.value)} />
            </div>
          </div>

          {/* Row 5: Email + Password */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} placeholder="vendor@example.com"
                value={formData.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" className={inputCls} placeholder="••••••••"
                value={formData.password} onChange={e => set('password', e.target.value)} required />
            </div>
          </div>

          {error   && <p className="text-red-700 text-sm">{error}</p>}
          {success && <p className="text-green-700 text-sm font-medium">Vendor created successfully! Redirecting...</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:"
          >
            {loading ? 'Creating Account...' : 'Register Vendor'}
          </button>
        </form>
      </div>
    </div>
  );
};
