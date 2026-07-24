import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';

interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export const AddVendorCategory = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get<Category[]>('/vendorcategories');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axiosInstance.post('/vendorcategories', { name: newName });

      setNewName('');
      fetchCategories();
    } catch (err) {
      console.error(err);
      setError('Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await axiosInstance.delete(`/vendorcategories/${id}`);
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-8">Vendor Categories Master</h2>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <form onSubmit={handleAdd} className="flex gap-4">
          <input
            type="text"
            className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Enter Category Name (e.g. IT, Construction)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:"
          >
            {loading ? 'Adding...' : 'Add Category'}
          </button>
        </form>
        {error && <p className="text-red-700 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Category Name</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-800 font-medium">{cat.name}</td>
                <td className="px-6 py-4 text-slate-600 text-sm">{new Date(cat.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="text-red-700 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-600">
                  No categories found. Add your first category above.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};
