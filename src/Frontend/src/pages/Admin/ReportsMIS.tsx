import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { rupees, rupeesCompact } from '../../utils/currency';
import axiosInstance from '../../api/axiosInstance';

interface WorkOrderSummary {
  totalValue?: number;
  status: string;
}

interface ProjectSummary {
  name?: string;
  budget: number;
  utilized: number;
  ldAmount: number;
}

export const ReportsMIS = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axiosInstance.get<WorkOrderSummary[]>('/workorders'),
      axiosInstance.get<ProjectSummary[]>('/projects'),
    ]).then(([wo, pr]) => {
      setWorkOrders(wo.data);
      setProjects(pr.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-600">Generating reports...</div>;

  const totalContractValue = workOrders.reduce((s, w) => s + (w.totalValue || 0), 0);
  const totalUtilized = projects.reduce((s, p) => s + (p.utilized || 0), 0);
  const totalLd = projects.reduce((s, p) => s + (p.ldAmount || 0), 0);
  const onTime = projects.filter(p => p.ldAmount === 0).length;

  const woStatusData = ['Draft', 'Authority Approval', 'Pending Vendor Acceptance', 'Accepted', 'Completed'].map(s => ({
    status: s.split(' ')[0],
    count: workOrders.filter(w => w.status === s).length
  }));

  const financialData = projects.map(p => ({
    name: p.name?.split(' ').slice(0, 3).join(' ') + '...',
    Budget: Math.round(p.budget / 100000),
    Utilized: Math.round(p.utilized / 100000),
  }));

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
          <BarChart2 className="w-8 h-8 text-indigo-600" />
          <span>Reports & MIS</span>
        </h1>
        <p className="text-slate-600 mt-1">Management Information System — consolidated performance overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-600">Total Contract Value</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{rupeesCompact(totalContractValue)}</p>
          <p className="text-xs text-slate-600 mt-1">across {workOrders.length} work orders</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-600">Total Funds Released</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{rupeesCompact(totalUtilized)}</p>
          <p className="text-xs text-slate-600 mt-1">{totalContractValue > 0 ? ((totalUtilized / totalContractValue) * 100).toFixed(1) : 0}% of total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-600 flex items-center space-x-1"><TrendingUp className="w-4 h-4 text-green-700" /><span>On-Time Projects</span></p>
          <p className="text-2xl font-bold text-green-700 mt-1">{onTime}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-600 flex items-center space-x-1"><AlertTriangle className="w-4 h-4 text-red-700" /><span>Estimated LD Liability</span></p>
          <p className="text-2xl font-bold text-red-700 mt-1">{rupeesCompact(totalLd)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Work Order Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Work Order Status Breakdown</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={woStatusData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-5} allowDecimals={false} />
                <Tooltip itemStyle={{ color: '#0f172a' }} labelStyle={{ color: '#0f172a' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget vs Utilized per Project */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Budget vs Utilized (₹ Lakhs)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dx={-5} />
                <Tooltip itemStyle={{ color: '#0f172a' }} labelStyle={{ color: '#0f172a' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend 
                  iconType="circle" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                  formatter={(value) => <span style={{ color: '#374151', fontWeight: 500 }}>{value}</span>}
                />
                <Bar dataKey="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Utilized" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Penalty Calculator Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
          <span>Penalty / LD Calculator</span>
        </h2>
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-slate-600 border-b border-slate-100">
            <tr>
              <th className="py-2 px-3">Project</th>
              <th className="py-2 px-3">Vendor</th>
              <th className="py-2 px-3">End Date</th>
              <th className="py-2 px-3">LD Status</th>
              <th className="py-2 px-3 text-right">Est. LD Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {projects.map((p: any) => (
              <tr key={p.id} className={p.ldAmount > 0 ? 'bg-red-50/30' : ''}>
                <td className="py-2 px-3 font-medium text-slate-700">{p.name}</td>
                <td className="py-2 px-3 text-slate-600">{p.vendorName}</td>
                <td className="py-2 px-3 text-slate-600">{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.ldAmount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {p.ldStatus === 'None' ? 'On Schedule' : p.ldStatus}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-semibold text-red-700">
                  {p.ldAmount > 0 ? rupees(p.ldAmount) : '—'}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-600">No project data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
