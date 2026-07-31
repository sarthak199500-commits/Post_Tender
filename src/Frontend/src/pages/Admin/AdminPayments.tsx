import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FileText, Search, CreditCard, Filter } from 'lucide-react';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';
import type { Bill, WorkOrder, Vendor } from '../../types/domain';

interface EnrichedBill extends Bill {
  totalAmount?: number;
  workOrderNo: string;
  vendorName: string;
}

interface PaymentsData {
  kpis: {
    totalFundsReleased: number;
    pendingApprovalValue: number;
    rejectedBillsCount: number;
    totalBudgetAllocated: number;
  };
  paymentHistory: EnrichedBill[];
}

export const AdminPayments = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterVendor, setFilterVendor] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const filterRef = React.useRef<HTMLDivElement>(null);

  // There is no /api/financialdashboard service or gateway route; this page used to
  // 404 on every load. The KPIs and payment history are all derivable from the bills
  // and work orders that FinancialService and TenderService already expose.
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [billsRes, workOrdersRes, vendorsRes] = await Promise.all([
          axiosInstance.get<(Bill & { totalAmount?: number })[]>('/bills'),
          axiosInstance.get<WorkOrder[]>('/workorders').catch(() => ({ data: [] as WorkOrder[] })),
          axiosInstance.get<Vendor[]>('/vendors').catch(() => ({ data: [] as Vendor[] })),
        ]);

        const bills = billsRes.data ?? [];
        const workOrders = workOrdersRes.data ?? [];
        const vendors = vendorsRes.data ?? [];

        const sumOf = (status: string) => bills
          .filter(b => b.status === status)
          .reduce((total, b) => total + (b.totalAmount ?? 0), 0);

        const describe = (bill: Bill & { totalAmount?: number }): EnrichedBill => {
          const workOrder = workOrders.find(w => w.id === bill.workOrderId);
          const vendor = vendors.find(v => v.id === workOrder?.vendorId);
          return {
            ...bill,
            workOrderNo: workOrder?.workOrderNo ?? '—',
            vendorName: vendor?.name ?? '—',
          };
        };

        setData({
          kpis: {
            totalFundsReleased: sumOf('Paid'),
            pendingApprovalValue: sumOf('Approved'),
            rejectedBillsCount: bills.filter(b => b.status === 'Returned').length,
            totalBudgetAllocated: workOrders.reduce((total, w) => total + (w.totalValue ?? 0), 0),
          },
          paymentHistory: bills.filter(b => b.status === 'Paid').map(describe),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch finance data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [token]);

  // Close the filter popover when clicking outside it.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (loading) return <div className="text-slate-600 font-bold text-center">Loading payment data...</div>;
  if (error) return <div className="text-red-700 font-bold text-center">{error}</div>;
  if (!data) return null;

  // Vendors actually present in the payout history, for the filter dropdown.
  const vendorOptions = Array.from(
    new Set(data.paymentHistory.map(p => p.vendorName).filter(v => v && v !== '—'))
  ).sort();
  const activeFilterCount = [filterVendor, filterFrom, filterTo].filter(Boolean).length;

  const clearFilters = () => { setFilterVendor(''); setFilterFrom(''); setFilterTo(''); };

  const filteredHistory = data.paymentHistory.filter(p => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      p.vendorName.toLowerCase().includes(term) ||
      p.billNo.toLowerCase().includes(term) ||
      p.workOrderNo.toLowerCase().includes(term) ||
      (p.paymentVoucherNo ?? '').toLowerCase().includes(term);
    if (!matchesSearch) return false;

    if (filterVendor && p.vendorName !== filterVendor) return false;

    const paid = p.paidAt ? new Date(p.paidAt) : null;
    if (filterFrom) {
      if (!paid || paid < new Date(filterFrom)) return false;
    }
    if (filterTo) {
      const end = new Date(filterTo);
      end.setHours(23, 59, 59, 999);
      if (!paid || paid > end) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
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
        <div className="bg-white p-6 rounded-card border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Total Released</p>
          <p className="text-3xl font-black text-slate-800 mt-2">₹{(data.kpis.totalFundsReleased / 10000000).toFixed(2)} Cr</p>
          <p className="text-xs font-bold text-emerald-700 mt-2">All successful payouts</p>
        </div>
        <div className="bg-white p-6 rounded-card border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Pending Release</p>
          <p className="text-3xl font-black text-slate-800 mt-2">₹{(data.kpis.pendingApprovalValue / 100000).toFixed(2)} L</p>
          <p className="text-xs font-bold text-amber-700 mt-2">Currently with Finance</p>
        </div>
        <div className="bg-white p-6 rounded-card border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Returned Bills</p>
          <p className="text-3xl font-black text-slate-800 mt-2">{data.kpis.rejectedBillsCount}</p>
          <p className="text-xs font-bold text-red-700 mt-2">Requires vendor action</p>
        </div>
        <div className="bg-white p-6 rounded-card border border-slate-200 shadow-sm flex flex-col justify-between bg-emerald-700 text-white">
          <p className="text-sm font-bold text-emerald-700 uppercase tracking-widest">Disbursement Rate</p>
          <p className="text-3xl font-black mt-2">
            {((data.kpis.totalFundsReleased / (data.kpis.totalBudgetAllocated || 1)) * 100).toFixed(1)}%
          </p>
          <p className="text-xs font-medium text-emerald-700 mt-2">of total budget</p>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Recent Disbursements</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600" />
              <input 
                type="text" 
                placeholder="Search vendor, WO, bill no..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-control text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64"
              />
            </div>
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setShowFilter(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-control text-sm font-semibold transition-colors ${
                  activeFilterCount > 0
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" /> Filter
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilter && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-white rounded-card z-50 p-4 space-y-4"
                  style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', animation: 'scaleIn 0.18s ease both', transformOrigin: 'top right' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Filter payouts</span>
                    {activeFilterCount > 0 && (
                      <button type="button" onClick={clearFilters} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">
                        Clear all
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Vendor</label>
                    <select
                      value={filterVendor}
                      onChange={e => setFilterVendor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-control text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      <option value="">All vendors</option>
                      {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Disbursement date</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-9 flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                        <input
                          type="date"
                          value={filterFrom}
                          max={filterTo || undefined}
                          onChange={e => setFilterFrom(e.target.value)}
                          aria-label="From date"
                          className="flex-1 min-w-0 px-2.5 py-2 border border-slate-200 rounded-control text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-9 flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                        <input
                          type="date"
                          value={filterTo}
                          min={filterFrom || undefined}
                          onChange={e => setFilterTo(e.target.value)}
                          aria-label="To date"
                          className="flex-1 min-w-0 px-2.5 py-2 border border-slate-200 rounded-control text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">{filteredHistory.length} of {data.paymentHistory.length} shown</span>
                    <button
                      type="button"
                      onClick={() => setShowFilter(false)}
                      className="px-3 py-1.5 rounded-control bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                <tr><td colSpan={7} className="text-center text-slate-600 py-8 font-medium">
                  {data.paymentHistory.length === 0
                    ? 'No payment history found.'
                    : (searchTerm || activeFilterCount > 0)
                      ? 'No disbursements match your search or filters.'
                      : 'No payment history found.'}
                </td></tr>
              ) : (
                filteredHistory.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-emerald-700">{p.paymentVoucherNo}</td>
                    <td className="p-4 text-sm font-medium text-slate-700">{new Date(p.paidAt ?? 0).toLocaleDateString()}</td>
                    <td className="p-4 text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      {p.billNo}
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">{p.workOrderNo}</td>
                    <td className="p-4 text-sm text-slate-600">{p.vendorName}</td>
                    <td className="p-4 text-right font-black text-slate-800">₹{(p.totalAmount ?? 0).toLocaleString('en-IN')}</td>
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
