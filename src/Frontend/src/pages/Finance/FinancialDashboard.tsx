import { fetchFinancialDashboard } from '../../api/dashboardService';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';
import { statusChipClass } from '../../utils/statusTone';

export const FinancialDashboard = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchFinancialDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const json = await fetchFinancialDashboard();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Full settlement by default; an explicit amount releases an instalment and leaves the
  // bill open at "Partially Paid" until the balance clears.
  const handlePayBill = async (id: string, balance: number, partial: boolean) => {
    let amount: number | undefined;

    if (partial) {
      const entered = window.prompt(
        `Outstanding balance is ₹${balance.toLocaleString('en-IN')}.
How much do you want to release now?`,
        String(balance)
      );
      if (entered === null) return;
      amount = Number(entered);
      if (!Number.isFinite(amount) || amount <= 0) { alert('Enter an amount greater than zero.'); return; }
      if (amount > balance) { alert(`That exceeds the outstanding balance of ₹${balance.toLocaleString('en-IN')}.`); return; }
    } else if (!window.confirm(`Release the full outstanding ₹${balance.toLocaleString('en-IN')} for this bill?`)) {
      return;
    }

    const reference = window.prompt('Payment reference (cheque no. / UTR) — optional:') ?? undefined;

    setActionLoading(id);
    try {
      await axiosInstance.post(`/bills/${id}/pay`, { amount, reference });
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to release funds');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBill = async (id: string) => {
    const reason = window.prompt('Enter reason for returning the bill:');
    if (!reason) return;

    setActionLoading(id);
    try {
      await axiosInstance.post(`/bills/${id}/reject`, { reason });
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to reject bill');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReleaseRetention = async (id: string, amount: number) => {
    if (!window.confirm(`Release the ${amount.toLocaleString('en-IN')} retention withheld on this bill?`)) return;
    setActionLoading(id);
    try {
      await axiosInstance.post(`/bills/${id}/release-retention`);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to release retention');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-slate-600 font-medium">Loading finance data...</div>;
  if (error) return <div className="text-red-700 font-medium">{error}</div>;
  if (!data) return null;

  return (
    <>
      <h1 className="sr-only">Financial Dashboard</h1>
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon bg-brand-50 text-brand-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/></svg>
            </div>
            <div className="kpi-lbl">Total Budget</div>
          </div>
          <div className="kpi-val">₹{(data.kpis.totalBudgetAllocated / 10000000).toFixed(2)} Cr</div>
          <div className="kpi-trend t-mute">Allocated across all projects</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon bg-emerald-50 text-emerald-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="kpi-lbl">Funds Released</div>
          </div>
          <div className="kpi-val text-emerald-700">₹{(data.kpis.totalFundsReleased / 100000).toFixed(2)} L</div>
          <div className="kpi-trend t-up">Total successful payments</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon bg-amber-50 text-amber-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div className="kpi-lbl">Pending Approval</div>
          </div>
          <div className="kpi-val">₹{(data.kpis.pendingApprovalValue / 100000).toFixed(2)} L</div>
          <div className="kpi-trend t-mute">Awaiting finance release</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon bg-red-50 text-red-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div className="kpi-lbl">Returned Bills</div>
          </div>
          <div className="kpi-val">{data.kpis.rejectedBillsCount}</div>
          <div className="kpi-trend t-dn">Requires vendor correction</div>
        </div>
      </div>

      {/* Pending Approvals Table */}
      <div className="tbl-card">
        {/* No "View All" here: this table already lists every pending release, and the
            only fuller billing view (/admin/billing) exposes approve/reject actions that
            Finance is not authorised for. */}
        <div className="tbl-hdr">
          <h2 className="tbl-title">Pending Fund Releases</h2>
          <span className="text-xs font-bold text-slate-500">{data.pendingApprovals.length} awaiting release</span>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="custom-table min-w-[800px]">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Work Order</th>
                <th>Vendor</th>
                <th>Submitted On</th>
                <th>Claimed</th>
                <th>Withheld</th>
                <th>Net Payable</th>
                <th>Paid / Balance</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.pendingApprovals.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-slate-600 py-6">No bills pending approval</td></tr>
              ) : (
                data.pendingApprovals.map(b => {
                  const withheld = b.retainedAmount + b.advanceRecovered + b.deductions.reduce((s, d) => s + d.amount, 0);
                  return (
                  <tr key={b.id}>
                    <td className="td-id">{b.billNo}{b.type === 'Advance' && <span className="ml-1.5 text-[10px] font-bold text-brand-600 uppercase">Advance</span>}</td>
                    <td className="td-wo">{b.workOrderNo}</td>
                    <td className="td-proj">{b.vendorName}</td>
                    <td className="td-date">{new Date(b.submittedAt).toLocaleDateString()}</td>
                    <td className="font-medium text-slate-600">₹{b.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="font-medium text-amber-700">{withheld > 0 ? `- ₹${withheld.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="td-val text-brand-700">₹{b.netPayableAmount.toLocaleString('en-IN')}</td>
                    <td className="text-xs font-medium">
                      {b.amountPaid > 0 ? (
                        <>
                          <span className="text-emerald-700 font-bold">₹{b.amountPaid.toLocaleString('en-IN')}</span>
                          <span className="text-slate-400"> paid · </span>
                          <span className="text-amber-700 font-bold">₹{b.balanceAmount.toLocaleString('en-IN')}</span>
                          <span className="text-slate-400"> due</span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      {actionLoading === b.id ? (
                        <span className="text-xs font-bold text-slate-600">Processing...</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handlePayBill(b.id, b.balanceAmount, false)} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded font-bold text-xs hover:bg-emerald-200 transition-colors">
                            ✓ Release Full
                          </button>
                          <button onClick={() => handlePayBill(b.id, b.balanceAmount, true)} className="px-3 py-1 bg-brand-50 text-brand-700 rounded font-bold text-xs hover:bg-brand-100 transition-colors">
                            Part Pay
                          </button>
                          <button onClick={() => handleRejectBill(b.id)} className="px-3 py-1 bg-red-50 text-red-700 rounded font-bold text-xs hover:bg-red-100 transition-colors">
                            ✗ Return
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="tbl-card">
        <div className="tbl-hdr">
          <h2 className="tbl-title">Payment History</h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="custom-table min-w-[800px]">
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Paid On</th>
                <th>Bill No</th>
                <th>Work Order</th>
                <th>Vendor</th>
                <th>Net Paid</th>
                <th>Retention</th>
              </tr>
            </thead>
            <tbody>
              {data.paymentHistory.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-slate-600 py-6">No payment history found</td></tr>
              ) : (
                data.paymentHistory.map(p => (
                  <tr key={p.id}>
                    <td className="td-id text-emerald-700">{p.paymentVoucherNo}</td>
                    <td className="td-date">{new Date(p.paidAt).toLocaleString('en-IN')}</td>
                    <td className="font-bold text-slate-600">{p.billNo}</td>
                    <td className="td-wo">{p.workOrderNo}</td>
                    <td className="td-proj">{p.vendorName}</td>
                    <td className="td-val">₹{p.netPayableAmount.toLocaleString('en-IN')}</td>
                    <td>
                      {p.retainedAmount <= 0 ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : p.retentionReleased ? (
                        <span className={`badge ${statusChipClass('Released')}`}>Released</span>
                      ) : actionLoading === p.id ? (
                        <span className="text-xs font-bold text-slate-600">Processing...</span>
                      ) : (
                        <button
                          onClick={() => handleReleaseRetention(p.id, p.retainedAmount)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded font-bold text-xs hover:bg-amber-100 transition-colors"
                        >
                          Release ₹{p.retainedAmount.toLocaleString('en-IN')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};



