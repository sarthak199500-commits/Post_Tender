import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../../store';

interface Vendor {
  id: string;
  name: string;
  vendorCode: string;
  gstNo: string;
  contactEmail: string;
  status: string;
  performanceScore: number;
}

const STATUS_OPTIONS = ['Active', 'On-Hold', 'Blacklisted'];

export const VendorDirectory = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    fetchVendors();
  }, [search]);

  const fetchVendors = async (filterStatus: string = '') => {
    try {
      let url = `http://localhost:5249/api/vendors?search=${encodeURIComponent(search)}`;
      if (filterStatus) url += `&status=${encodeURIComponent(filterStatus)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setVendors(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (vendorId: string, newStatus: string) => {
    try {
      const res = await fetch(`http://localhost:5249/api/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: newStatus } : v));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (vendorId: string, vendorName: string) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendorName}"? This will also remove their login account.`)) return;
    setDeleteError('');
    try {
      const res = await fetch(`http://localhost:5249/api/vendors/${vendorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVendors(prev => prev.filter(v => v.id !== vendorId));
      } else {
        const text = await res.text();
        setDeleteError(`Delete failed (${res.status}): ${text}`);
      }
    } catch (e: any) {
      setDeleteError(`Network error: ${e.message}`);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'Active') return 'bg-green-100 text-green-700 border-green-300';
    if (status === 'Blacklisted') return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-amber-100 text-amber-700 border-amber-300';
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Vendor Directory</h1>
        {deleteError && (
          <p className="text-red-700 text-sm font-medium bg-red-50 px-4 py-2 rounded-lg">{deleteError}</p>
        )}
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search by Name or Code" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <select aria-label="Select an option" 
            onChange={(e) => fetchVendors(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On-Hold">On-Hold</option>
            <option value="Blacklisted">Blacklisted</option>
          </select>
          <Link to="/admin/masters/vendors/add" className="bg-blue-700 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Vendor
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600 uppercase tracking-wider">
              <th className="p-4">Vendor Name</th>
              <th className="p-4">Vendor Code</th>
              <th className="p-4">Contact Email</th>
              <th className="p-4">Status</th>
              <th className="p-4">Performance</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors.map(v => (
              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-semibold text-slate-700">{v.name}</td>
                <td className="p-4 text-slate-600">{v.vendorCode}</td>
                <td className="p-4 text-slate-600">{v.contactEmail}</td>
                <td className="p-4">
                  <select aria-label="Select an option"
                    value={v.status || 'Active'}
                    onChange={(e) => handleStatusChange(v.id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${statusColor(v.status)}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-slate-700">{v.performanceScore || 100}%</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleDelete(v.id, v.name)}
                    className="text-red-700 hover:text-red-700 text-sm font-medium transition-colors"
                  >
                    🗑 Delete
                  </button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-600">No vendors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
