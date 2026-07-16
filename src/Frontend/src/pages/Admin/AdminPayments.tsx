import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FileText, Search, CreditCard, Filter } from 'lucide-react';
import type { RootState } from '../../store';

export const AdminPayments = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:5249/api/financialdashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch finance data');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [token]);

  if (loading) return <div className="p-12 text-slate-600 font-bold text-center">Loading payment data...</div>;
  if (error) return <div className="p-12 text-red-700 font-bold text-center">{error}</div>;
  if (!data) return null;

  const filteredHistory = data.paymentHistory.filter((p: any) => 
    p.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.workOrderNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-emerald-700" />
            Payment History & Disbursements
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Overview of all successful payouts made by Finance.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Total Released</p>
          <p className="text-3xl font-black text-slate-800 mt-2">₹{(data.kpis.totalFundsReleased / 10000000).toFixed(2)} Cr</p>
          <p className="text-xs font-bold text-emerald-700 mt-2">All successful payouts</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Pending Release</p>
          <p className="text-3xl font-black text-slate-800 mt-2">₹{(data.kpis.pendingApprovalValue / 100000).toFixed(2)} L</p>
          <p className="text-xs font-bold text-amber-700 mt-2">Currently with Finance</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Returned Bills</p>
          <p className="text-3xl font-black text-slate-800 mt-2">{data.kpis.rejectedBillsCount}</p>
          <p className="text-xs font-bold text-red-700 mt-2">Requires vendor action</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between bg-emerald-700 text-white">
          <p className="text-sm font-bold text-emerald-700 uppercase tracking-widest">Disbursement Rate</p>
          <p className="text-3xl font-black mt-2">
            {((data.kpis.totalFundsReleased / (data.kpis.totalBudgetAllocated || 1)) * 100).toFixed(1)}%
          </p>
          <p className="text-xs font-medium text-emerald-700 mt-2">of total budget</p>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Recent Disbursements</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600" />
              <input 
                type="text" 
                placeholder="Search vendor, WO, bill no..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100">
                <th className="p-4">Voucher No</th>
                <th className="p-4">Disbursement Date</th>
                <th className="p-4">Bill No</th>
                <th className="p-4">Work Order</th>
                <th className="p-4">Vendor</th>
                <th className="p-4 text-right">Amount Released</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600 py-8 font-medium">No payment history found.</td></tr>
              ) : (
                filteredHistory.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-emerald-700">{p.paymentVoucherNo}</td>
                    <td className="p-4 text-sm font-medium text-slate-700">{new Date(p.paidAt).toLocaleDateString()}</td>
                    <td className="p-4 text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      {p.billNo}
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">{p.workOrderNo}</td>
                    <td className="p-4 text-sm text-slate-600">{p.vendorName}</td>
                    <td className="p-4 text-right font-black text-slate-800">₹{p.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full">Paid</span>
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
