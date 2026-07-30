import { fetchDepartmentDashboard } from '../../api/dashboardService';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';

interface DashKpis {
  totalWorkOrders: number;
  pendingReports: number;
  billsPendingApproval: number;
  totalFundRequests: number;
  approvedThisMonth: number;
  openQueries: number;
}
interface InspectorReport {
  id: string;
  projectName: string;
  vendorName: string;
  workDescription: string;
  reportedAt: string;
  status: string;
  milestoneTitle?: string;
}
interface BillDeductionItem {
  id: string;
  type: string;
  description: string;
  amount: number;
  isSystemGenerated?: boolean;
}
interface BillItem {
  id: string;
  billNo: string;
  type?: string;
  workOrderNo: string;
  vendorName: string;
  amount: number;
  taxAmount: number;
  submittedAt: string;
  status: string;
  paymentVoucherNo: string | null;
  deductions: BillDeductionItem[];
}
interface ActivityItem {
  action: string;
  timestamp: string;
  changesInfo: string;
  entityName: string;
}

export const DepartmentDashboard = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [kpis, setKpis] = useState<DashKpis | null>(null);
  const [reports, setReports] = useState<InspectorReport[]>([]);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState('All');
  const [billFilter, setBillFilter] = useState('All');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = () => {
    setError(null);
    fetchDepartmentDashboard()
      .then(data => {
        setKpis(data.kpis);
        setReports(data.inspectorReports || []);
        setBills(data.billsPending || []);
        setActivity(data.recentActivity || []);
      })
      .catch(err => { console.error(err); setError('Failed to load department dashboard data.'); });
  };

  useEffect(() => { fetchData(); }, [token]);

  const doAction = async (url: string, reason?: string) => {
    setActionLoading(url);
    try {
      await axiosInstance.post(url, reason ? { reason } : {});
      fetchData();
    } catch (err) { console.error(err); alert('Action failed. Please try again.'); }
    finally { setActionLoading(null); }
  };

  const handleApproveReport = (id: string) => doAction(`/progressreports/${id}/approve`);
  const handleQueryReport = (id: string) => {
    const reason = prompt('Enter the reason for raising a query:');
    if (reason) doAction(`/progressreports/${id}/query`, reason);
  };
  const handleApproveBill = (id: string) => doAction(`/bills/${id}/approve`);
  const handleQueryBill = (id: string) => {
    const reason = prompt('Enter the reason for returning this bill:');
    if (reason) doAction(`/bills/${id}/query`, reason);
  };

  const DEDUCTION_TYPES = ['LiquidatedDamages', 'TDS', 'LabourCess', 'SecurityDeposit', 'Other'];
  const handleAddDeduction = async (id: string) => {
    const type = prompt(`Deduction type (${DEDUCTION_TYPES.join(' / ')}):`, 'Other');
    if (!type) return;
    const description = prompt('Description:');
    if (!description) return;
    const amountStr = prompt('Amount (₹):');
    const amount = Number(amountStr);
    if (!amountStr || !Number.isFinite(amount) || amount <= 0) { alert('Enter a valid amount greater than zero.'); return; }

    setActionLoading(`deduct-${id}`);
    try {
      await axiosInstance.post(`/bills/${id}/deductions`, { type, description, amount });
      fetchData();
    } catch (err) { console.error(err); alert('Failed to add deduction. Please try again.'); }
    finally { setActionLoading(null); }
  };
  const handleRemoveDeduction = async (billId: string, deductionId: string) => {
    if (!window.confirm('Remove this deduction?')) return;
    setActionLoading(`deduct-${billId}`);
    try {
      await axiosInstance.delete(`/bills/${billId}/deductions/${deductionId}`);
      fetchData();
    } catch (err) { console.error(err); alert('Failed to remove deduction. Please try again.'); }
    finally { setActionLoading(null); }
  };

  const badgeClass = (status: string) => {
    const map: Record<string, string> = {
      'Submitted': 'b-ip', 'Reviewed': 'b-hi', 'Approved': 'b-cp', 'QueryRaised': 'b-od',
      'Paid': 'b-cp', 'Returned': 'b-od', 'Completed': 'b-cp',
      'Pending': 'b-dr', 'Open': 'b-open', 'In Progress': 'b-ip'
    };
    return map[status] || 'b-dr';
  };

  const filteredReports = reportFilter === 'All' ? reports : reports.filter(r => r.status === reportFilter);
  const filteredBills = billFilter === 'All' ? bills : bills.filter(b => b.status === billFilter);

  if (error) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3">
        <span className="font-medium">{error}</span>
      </div>
      <button onClick={fetchData} className="save-btn">Retry</button>
    </div>
  );

  if (!kpis) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="text-slate-600 font-medium italic">Loading department dashboard...</p>
    </div>
  );

  return (
    <>
      <h1 className="sr-only">Department Dashboard</h1>
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>
            </div>
            <div className="kpi-lbl">Total Work Orders</div>
          </div>
          <div className="kpi-val">{kpis.totalWorkOrders}</div>
          <div className="kpi-trend"><span className="t-mute">All tracked WOs</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#ffedd5', color: '#c2410c' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            </div>
            <div className="kpi-lbl">Pending Reports</div>
          </div>
          <div className="kpi-val">{kpis.pendingReports}</div>
          <div className="kpi-trend"><span className="t-dn">Awaiting review</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#fef3c7', color: '#92400e' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            </div>
            <div className="kpi-lbl">Bills Pending</div>
          </div>
          <div className="kpi-val">{kpis.billsPendingApproval}</div>
          <div className="kpi-trend"><span className="t-dn">Need approval</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></svg>
            </div>
            <div className="kpi-lbl">Fund Requests</div>
          </div>
          <div className="kpi-val">{kpis.totalFundRequests}</div>
          <div className="kpi-trend"><span className="t-up">Ready to release</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <div className="kpi-lbl">Approved (Month)</div>
          </div>
          <div className="kpi-val">{kpis.approvedThisMonth}</div>
          <div className="kpi-trend"><span className="t-up">This month</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <div className="kpi-lbl">Open Queries</div>
          </div>
          <div className="kpi-val">{kpis.openQueries}</div>
          <div className="kpi-trend"><span className="t-dn">Unresolved</span></div>
        </div>
      </div>

      {/* Inspector Reports Table */}
      <div className="tbl-card">
        <div className="tbl-hdr">
          <div className="tbl-title">Inspector Progress Reports</div>
          <div className="filter-bar">
            {['All', 'Submitted', 'Reviewed', 'Approved', 'QueryRaised'].map(f => (
              <div key={f} className={`filter-tab ${reportFilter === f ? 'active' : ''}`} onClick={() => setReportFilter(f)}>
                {f === 'QueryRaised' ? 'Query Raised' : f}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="custom-table min-w-[800px]">
            <thead>
            <tr>
              <th>Project</th>
              <th>Vendor</th>
              <th>Linked Milestone</th>
              <th>Description</th>
              <th>Reported</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-600">No reports found</td></tr>
            ) : filteredReports.map(r => (
              <tr key={r.id}>
                <td className="td-proj">{r.projectName}</td>
                <td className="td-wo">{r.vendorName}</td>
                <td>
                  <span className="text-sm font-semibold text-slate-600">
                    {r.milestoneTitle && r.milestoneTitle !== 'N/A' ? r.milestoneTitle : 'N/A'}
                  </span>
                </td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.workDescription}>{r.workDescription}</td>
                <td className="td-date">{new Date(r.reportedAt).toLocaleDateString('en-IN')}</td>
                <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(r.status === 'Submitted' || r.status === 'Reviewed') && (
                      <>
                        <button onClick={() => handleApproveReport(r.id)} disabled={actionLoading !== null}
                          className="save-btn" style={{ padding: '4px 10px', fontSize: '10.5px', background: '#15803d' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleQueryReport(r.id)} disabled={actionLoading !== null}
                          className="save-btn" style={{ padding: '4px 10px', fontSize: '10.5px', background: '#dc2626' }}>
                          ? Query
                        </button>
                      </>
                    )}
                    {r.status === 'Approved' && <span className="text-xs text-green-700 font-bold">✓ Done</span>}
                    {r.status === 'QueryRaised' && <span className="text-xs text-red-700 font-bold">⚠ Queried</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Bills Pending Approval */}
      <div className="tbl-card">
        <div className="tbl-hdr">
          <div className="tbl-title">Bills & Fund Requests</div>
          <div className="filter-bar">
            {['All', 'Submitted', 'Approved', 'Paid', 'Returned'].map(f => (
              <div key={f} className={`filter-tab ${billFilter === f ? 'active' : ''}`} onClick={() => setBillFilter(f)}>
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="custom-table min-w-[1000px]">
            <thead>
            <tr>
              <th>Bill No</th>
              <th>Work Order</th>
              <th>Vendor</th>
              <th>Amount (₹)</th>
              <th>Tax (₹)</th>
              <th>Deductions</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Voucher</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-slate-600">No bills found</td></tr>
            ) : filteredBills.map(b => (
              <tr key={b.id}>
                <td className="td-id">{b.billNo}{b.type === 'Advance' && <span className="ml-1.5 text-[10px] font-bold text-indigo-600 uppercase">Advance</span>}</td>
                <td className="td-wo">{b.workOrderNo}</td>
                <td>{b.vendorName}</td>
                <td className="td-val">₹{b.amount.toLocaleString('en-IN')}</td>
                <td className="td-date">₹{b.taxAmount.toLocaleString('en-IN')}</td>
                <td>
                  <div className="space-y-1">
                    {b.deductions.map(d => (
                      <div key={d.id} className="flex items-center gap-1.5 text-[11px]">
                        <span className={`font-bold ${d.isSystemGenerated ? 'text-amber-700' : 'text-slate-600'}`}>
                          {d.type}: ₹{d.amount.toLocaleString('en-IN')}
                        </span>
                        {b.status !== 'Paid' && (
                          <button onClick={() => handleRemoveDeduction(b.id, d.id)} disabled={actionLoading !== null}
                            className="text-red-600 hover:text-red-800" title={d.description}>✕</button>
                        )}
                      </div>
                    ))}
                    {b.status !== 'Paid' && (
                      <button onClick={() => handleAddDeduction(b.id)} disabled={actionLoading !== null}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                        + Deduction
                      </button>
                    )}
                  </div>
                </td>
                <td className="td-date">{new Date(b.submittedAt).toLocaleDateString('en-IN')}</td>
                <td><span className={`badge ${badgeClass(b.status)}`}>{b.status}</span></td>
                <td className="td-wo">{b.paymentVoucherNo || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {b.status === 'Submitted' && (
                      <>
                        <button onClick={() => handleApproveBill(b.id)} disabled={actionLoading !== null}
                          className="save-btn" style={{ padding: '4px 10px', fontSize: '10.5px', background: '#15803d' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleQueryBill(b.id)} disabled={actionLoading !== null}
                          className="save-btn" style={{ padding: '4px 10px', fontSize: '10.5px', background: '#dc2626' }}>
                          ✗ Return
                        </button>
                      </>
                    )}
                    {b.status === 'Approved' && <span className="text-xs text-green-700 font-bold">✓ For Payment</span>}
                    {b.status === 'Paid' && <span className="text-xs text-green-700 font-bold">💰 Paid</span>}
                    {b.status === 'Returned' && <span className="text-xs text-red-700 font-bold">⚠ Returned</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="tbl-card">
        <div className="tbl-hdr">
          <div className="tbl-title">Recent Activity</div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="custom-table min-w-[800px]">
            <thead>
            <tr>
              <th>Entity</th>
              <th>Action</th>
              <th>Details</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {activity.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-600">No activity recorded</td></tr>
            ) : activity.map((a, i) => (
              <tr key={i}>
                <td><span className="badge b-md">{a.entityName}</span></td>
                <td className="td-proj font-semibold">{a.action}</td>
                <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.changesInfo}>{a.changesInfo}</td>
                <td className="td-date">{new Date(a.timestamp).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
};

export default DepartmentDashboard;



