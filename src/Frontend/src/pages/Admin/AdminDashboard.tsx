import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip,   XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { rupeesCompact } from '../../utils/currency';
import { Eye } from 'lucide-react';

interface DashboardData {
  topKpis: {
    activeTenders: number;
    inProgressWOs: number;
    totalValue: number;
    delayedProjects: number;
    inspectionsPending: number;
  };
  bottomKpis: {
    avgTimeOverdue: number;
    onTimeCompletionPct: number;
    budgetUtilizationPct: number;
    paymentsMade: number;
    activeVendors: number;
    trends: {
      overdue: number;
      onTime: number;
      budget: number;
      payments: number;
      vendors: number;
    };
  };
  charts: {
    status: Array<{ name: string; value: number; color: string }>;
    progress: Array<{ date: string; completed: number; inProgress: number; overdue: number }>;
    department: Array<{ name: string; value: number; pct: number }>;
  };
  recentTenders: Array<{
    id: string;
    workOrderId: string | null;
    woNumber: string;
    projectName: string;
    department: string;
    value: number;
    status: string;
    progress: number;
    startDate: string;
    endDate: string;
  }>;
  vendorHealth: Array<{
    id: string;
    name: string;
    vendorCode: string;
    status: string;
    performanceScore: number;
  }>;
}

import { fetchAdminDashboard } from '../../api/dashboardService';

/**
 * Status colours are semantic, not positional — a status keeps its colour
 * regardless of where it lands in the list, so "Cancelled" is always red and
 * "Completed" always green.
 */
const STATUS_TONE: Record<string, { solid: string; bar: string }> = {
  completed: { solid: '#10b981', bar: 'linear-gradient(90deg, #10b981, #34d399)' },
  accepted: { solid: '#4f6ef7', bar: 'linear-gradient(90deg, #4f6ef7, #6366f1)' },
  issued: { solid: '#3b82f6', bar: 'linear-gradient(90deg, #3b82f6, #60a5fa)' },
  'in progress': { solid: '#3b82f6', bar: 'linear-gradient(90deg, #3b82f6, #60a5fa)' },
  awarded: { solid: '#10b981', bar: 'linear-gradient(90deg, #10b981, #34d399)' },
  open: { solid: '#3b82f6', bar: 'linear-gradient(90deg, #3b82f6, #60a5fa)' },
  draft: { solid: '#94a3b8', bar: 'linear-gradient(90deg, #94a3b8, #cbd5e1)' },
  pending: { solid: '#f59e0b', bar: 'linear-gradient(90deg, #f59e0b, #fbbf24)' },
  overdue: { solid: '#f59e0b', bar: 'linear-gradient(90deg, #f59e0b, #fbbf24)' },
  cancelled: { solid: '#ef4444', bar: 'linear-gradient(90deg, #ef4444, #f87171)' },
  rejected: { solid: '#ef4444', bar: 'linear-gradient(90deg, #ef4444, #f87171)' },
  closed: { solid: '#64748b', bar: 'linear-gradient(90deg, #64748b, #94a3b8)' },
};

const toneFor = (name: string) =>
  STATUS_TONE[(name || '').toLowerCase()] ?? { solid: '#64748b', bar: 'linear-gradient(90deg, #64748b, #94a3b8)' };

/** Shared empty/insufficient-data placeholder so all three cards read alike. */
const CardEmpty = ({ line1, line2 }: { line1: string; line2?: string }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', padding: '12px' }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg>
    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>{line1}</div>
    {line2 && <div style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '210px', lineHeight: 1.5 }}>{line2}</div>}
  </div>
);

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { token } = useSelector((state: RootState) => state.auth);

  const fetchDashboard = () => {
    setError(null);
    fetchAdminDashboard()
    .then(data => setData(data))
    .catch(err => {
      console.error(err);
      setError("Failed to load dashboard data. Please ensure the API is running.");
    });
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  if (error) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3">
        <span className="font-medium">{error}</span>
      </div>
      <button onClick={fetchDashboard} className="px-6 py-2 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
        Retry
      </button>
    </div>
  );

  if (!data) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="text-slate-600 font-medium italic">Loading secure dashboard data...</p>
    </div>
  );

  return (
    <>
      <h1 className="sr-only">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{background: '#dbeafe', color: '#1d4ed8'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div className="kpi-lbl">Active Tenders</div>
          </div>
          <div className="kpi-val">{data.topKpis.activeTenders}</div>
          <div className="kpi-trend"><span className="t-mute">Not yet closed</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{background: '#e0e7ff', color: '#4f46e5'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div className="kpi-lbl">In-Progress WOs</div>
          </div>
          <div className="kpi-val">{data.topKpis.inProgressWOs}</div>
          <div className="kpi-trend"><span className="t-mute">Currently accepted</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{background: '#dcfce7', color: '#15803d'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/></svg>
            </div>
            <div className="kpi-lbl">Total Value (Cr)</div>
          </div>
          <div className="kpi-val">{rupeesCompact(data.topKpis.totalValue)}</div>
          <div className="kpi-trend"><span className="t-mute">Sum of tender budgets</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{background: '#fee2e2', color: '#b91c1c'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="kpi-lbl">Delayed Projects</div>
          </div>
          <div className="kpi-val">{data.topKpis.delayedProjects}</div>
          <div className="kpi-trend"><span className="t-mute">Past end date, not completed</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{background: '#f3e8ff', color: '#7e22ce'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div className="kpi-lbl">Inspections Pending</div>
          </div>
          <div className="kpi-val">{data.topKpis.inspectionsPending}</div>
          <div className="kpi-trend"><span className="t-mute">Scheduled for today</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
        <div className="bot-card">
          <div className="kpi-icon" style={{background: '#fee2e2', color: '#ef4444'}}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <div className="text-xs text-slate-600 font-medium">Avg. Time Overdue</div>
            <div className="text-[17px] font-bold text-slate-800">{data.bottomKpis.avgTimeOverdue} <span className="text-xs font-normal text-slate-600">days</span></div>
            <div className="text-[10px] text-green-700 mt-[2px] flex items-center gap-1 font-medium">
                <span className={data.bottomKpis.trends.overdue > 0 ? "text-red-700" : "text-green-700"}>
                    {data.bottomKpis.trends.overdue > 0 ? "↗" : "↘"} {Math.abs(data.bottomKpis.trends.overdue)} days
                </span> 
                <span className="text-slate-600 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        <div className="bot-card">
          <div className="kpi-icon" style={{background: '#ccfbf1', color: '#0f766e'}}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div className="text-xs text-slate-600 font-medium">On-time Completion</div>
            <div className="text-[17px] font-bold text-slate-800">{data.bottomKpis.onTimeCompletionPct}%</div>
            <div className="text-[10px] text-green-700 mt-[2px] flex items-center gap-1 font-medium">
                <span className={data.bottomKpis.trends.onTime > 0 ? "text-green-700" : "text-red-700"}>
                    {data.bottomKpis.trends.onTime > 0 ? "↗" : "↘"} {Math.abs(data.bottomKpis.trends.onTime)}%
                </span> 
                <span className="text-slate-600 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        <div className="bot-card">
          <div className="kpi-icon" style={{background: '#e0e7ff', color: '#4338ca'}}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2-2.4-3.5-4.4-3.5h-1.2c-.7-3-3.2-5.2-6.2-5.6-3-.3-5.9 1.3-7.3 4-1.2 2.5-1 6.5.5 8.8m8.7-1.6V21"/><path d="M16 16l-4-4-4 4"/></svg>
          </div>
          <div>
            <div className="text-xs text-slate-600 font-medium">Budget Utilization</div>
            <div className="text-[17px] font-bold text-slate-800">{data.bottomKpis.budgetUtilizationPct}%</div>
            <div className="text-[10px] text-green-700 mt-[2px] flex items-center gap-1 font-medium">
                <span className={data.bottomKpis.trends.budget > 0 ? "text-green-700" : "text-red-700"}>
                    {data.bottomKpis.trends.budget > 0 ? "↗" : "↘"} {Math.abs(data.bottomKpis.trends.budget)}%
                </span> 
                <span className="text-slate-600 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        <div className="bot-card">
          <div className="kpi-icon" style={{background: '#fae8ff', color: '#a21caf'}}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <div>
            <div className="text-xs text-slate-600 font-medium">Payments Made</div>
            <div className="text-[17px] font-bold text-slate-800">{rupeesCompact(data.bottomKpis.paymentsMade)}</div>
            <div className="text-[10px] text-green-700 mt-[2px] flex items-center gap-1 font-medium">
                <span className={data.bottomKpis.trends.payments > 0 ? "text-green-700" : "text-red-700"}>
                    {data.bottomKpis.trends.payments > 0 ? "↗" : "↘"} {Math.abs(data.bottomKpis.trends.payments)}%
                </span> 
                <span className="text-slate-600 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        <div className="bot-card">
          <div className="kpi-icon" style={{background: '#f3e8ff', color: '#7e22ce'}}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div className="text-xs text-slate-600 font-medium">Active Vendors</div>
            <div className="text-[17px] font-bold text-slate-800">{data.bottomKpis.activeVendors}</div>
            <div className="text-[10px] text-green-700 mt-[2px] flex items-center gap-1 font-medium">
                <span className={data.bottomKpis.trends.vendors > 0 ? "text-green-700" : "text-red-700"}>
                    {data.bottomKpis.trends.vendors > 0 ? "↗" : "↘"} {Math.abs(data.bottomKpis.trends.vendors)}%
                </span> 
                <span className="text-slate-600 font-normal">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        {/* ── Tenders by Status ── */}
        <div className="chart-card" style={{ minHeight: '340px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(135deg, #eef1fe, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              </div>
              <div className="c-title" style={{ marginBottom: 0 }}>Tenders by Status</div>
            </div>
            <button type="button" className="c-link" onClick={() => navigate('/admin/masters/tenders')} style={{ paddingTop: 0, marginTop: 0, fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {(() => {
              const total = data.charts.status.reduce((acc, curr) => acc + curr.value, 0);
              if (!total) return <CardEmpty line1="No tenders yet" line2="Status breakdown appears once tenders are created." />;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                  {/* Donut */}
                  <div style={{ position: 'relative', width: '132px', height: '132px', flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.charts.status} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none" cornerRadius={3}>
                          {data.charts.status.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${Number(value)} (${Math.round((Number(value) / total) * 100)}%)`, name]}
                          itemStyle={{ color: '#0f172a', fontSize: '12px' }}
                          labelStyle={{ color: '#0f172a' }}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '8px 14px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <div className="dc-num">{total}</div>
                      <div className="dc-lbl">Total</div>
                    </div>
                  </div>
                  {/* Legend — share of total, not just raw counts */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', minWidth: 0 }}>
                    {data.charts.status.map((item, idx) => {
                      const pct = Math.round((item.value / total) * 100);
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }}></div>
                              <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0c1222', flexShrink: 0 }}>
                              {item.value}
                              <span style={{ color: '#cbd5e1', fontWeight: 500, margin: '0 5px' }}>·</span>
                              <span style={{ color: '#94a3b8', fontWeight: 600 }}>{pct}%</span>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: '#eef1f6', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: '3px', transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Progress Overview ── */}
        <div className="chart-card" style={{ minHeight: '340px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="c-title" style={{ marginBottom: 0 }}>Progress Overview</div>
            </div>
            <button type="button" className="c-link" onClick={() => navigate('/admin/reports')} style={{ paddingTop: 0, marginTop: 0, fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Full report →</button>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {(() => {
              const series = [
                { key: 'completed' as const, label: 'Completed', color: '#10b981' },
                { key: 'inProgress' as const, label: 'In Progress', color: '#4f6ef7' },
                { key: 'overdue' as const, label: 'Overdue', color: '#f59e0b' },
              ];
              const buckets = data.charts.progress;

              if (buckets.length === 0) {
                return <CardEmpty line1="No activity yet" line2="Work order progress appears here once orders are issued." />;
              }

              // A line chart needs at least two points to describe a trend. With a
              // single month of history, show that month's actual split instead of
              // rendering an empty plot area.
              if (buckets.length === 1) {
                const b = buckets[0];
                const total = series.reduce((s, x) => s + (b[x.key] || 0), 0);
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {b.date} · {total} work order{total === 1 ? '' : 's'}
                    </div>
                    {series.map(s => {
                      const v = b[s.key] || 0;
                      const pct = total ? Math.round((v / total) * 100) : 0;
                      return (
                        <div key={s.key}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                              <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>{s.label}</span>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1222' }}>{v}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#eef1f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '4px', transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: 1.5 }}>
                      Trend line appears once there's more than one month of activity.
                    </div>
                  </div>
                );
              }

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={buckets} margin={{ top: 0, right: 8, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} dx={-5} />
                    <Tooltip
                      itemStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 500 }}
                      labelStyle={{ color: '#64748b', fontWeight: 600, fontSize: '11px' }}
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '10px 14px' }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '16px', marginTop: '-10px' }}
                      formatter={(value) => <span style={{ color: '#64748b', fontWeight: 600, fontSize: '11px' }}>{value}</span>}
                    />
                    {series.map(s => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        strokeWidth={2.5}
                        dot={buckets.length <= 6 ? { r: 3, fill: s.color, stroke: '#fff', strokeWidth: 1.5 } : false}
                        activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>

        {/* ── Work Orders by Status ── */}
        <div className="chart-card" style={{ minHeight: '340px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div className="c-title" style={{ marginBottom: 0 }}>Work Orders by Status</div>
            </div>
            <button type="button" className="c-link" onClick={() => navigate('/admin/work-orders')} style={{ paddingTop: 0, marginTop: 0, fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View work orders →</button>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            {(() => {
              const rows = data.charts.department;
              const total = rows.reduce((s, r) => s + r.value, 0);
              if (!total) return <CardEmpty line1="No work orders yet" line2="Status breakdown appears once work orders are issued." />;
              return (
                <>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    {total} work order{total === 1 ? '' : 's'} total
                  </div>
                  {rows.map((d, i) => {
                    const tone = toneFor(d.name);
                    // Share of total reads honestly next to the donut card, which
                    // uses the same measure.
                    const pct = Math.round((d.value / total) * 100);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => navigate('/admin/work-orders')}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', transition: 'background 0.15s ease', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,110,247,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tone.solid, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c1222', flexShrink: 0 }}>
                              {d.value}
                              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 500, margin: '0 5px' }}>·</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{pct}%</span>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#eef1f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: tone.bar, borderRadius: '4px', transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="tbl-card mt-4">
        <div className="tbl-hdr">
          <div className="tbl-title">Recent Tenders</div>
          <button type="button" className="tbl-va" onClick={() => navigate('/admin/masters/tenders')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View All</button>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="custom-table min-w-[800px]">
            <thead>
            <tr>
              <th>Tender ID</th>
              <th>WO Number</th>
              <th>Project Name</th>
              <th>Department</th>
              <th>Value</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {data.recentTenders.map((row, index) => (
              <tr key={index}>
                <td className="td-id">{row.id}</td>
                <td className="td-wo">{row.woNumber}</td>
                <td className="td-proj">{row.projectName}</td>
                <td className="text-slate-600 font-medium">{row.department}</td>
                <td className="td-val font-semibold text-slate-700">{typeof row.value === 'number' ? rupeesCompact(row.value) : row.value}</td>
                <td>
                  <span className={`badge ${row.status === 'Completed' ? 'b-ok' : row.status === 'Overdue' ? 'b-od' : 'b-ip'}`}
                        style={{
                            background: row.status === 'Completed' ? '#dcfce7' : row.status === 'Overdue' ? '#fee2e2' : '#dbeafe',
                            color: row.status === 'Completed' ? '#166534' : row.status === 'Overdue' ? '#991b1b' : '#1e40af'
                        }}>
                    {row.status}
                  </span>
                </td>
                <td>
                  <div className="prog-cell">
                    <div className="prog-pct">{row.progress}%</div>
                    <div className="prog-bar">
                        <div className={`prog-fill ${row.progress < 50 ? 'pf-red' : ''}`} 
                             style={{width: `${row.progress}%`, background: row.progress < 50 ? '#ef4444' : row.progress === 100 ? '#22c55e' : '#f59e0b'}}>
                        </div>
                    </div>
                  </div>
                </td>
                <td className="text-slate-600 text-[11px] whitespace-nowrap">{row.startDate}</td>
                <td className="text-slate-600 text-[11px] whitespace-nowrap">{row.endDate}</td>
                <td>
                  <button
                    type="button"
                    aria-label="View Details"
                    title={row.workOrderId ? 'View work order' : 'No work order issued yet'}
                    disabled={!row.workOrderId}
                    onClick={() => row.workOrderId && navigate(`/admin/work-orders/${row.workOrderId}`)}
                    className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
                  >
                    <Eye size={16} strokeWidth={2.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
};
