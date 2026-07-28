import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Target, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { rupees, rupeesCompact } from '../../utils/currency';
import axiosInstance from '../../api/axiosInstance';
import type { Bill, Milestone as MilestoneDto, Vendor, WorkOrder } from '../../types/domain';

/**
 * The view model this page renders. GET /projects returns only the bare Project entity
 * (id, workOrderId, name, budget, status, …) — vendor, work-order number, utilisation,
 * LD and milestones all live in other services and are joined below. Reading them
 * straight off the raw payload is what used to blank this page: an undefined `utilized`
 * reached rupees() and threw on undefined.toLocaleString().
 */
interface ProjectRow {
  id: string;
  name: string;
  budget: number;
  status: string;
  vendorName: string;
  workOrderNo: string;
  endDate: string;
  financialUtilization: number;
  utilized: number;
  ldAmount: number;
  ldStatus: string;
  pendingBills: number;
  milestones: { title: string; status: string; weightage: number; completionDate: string | null; targetDate: string }[];
}

interface RawProject {
  id: string;
  workOrderId?: string;
  name?: string;
  budget?: number;
  status?: string;
}

/** Resolves to [] rather than rejecting — one failed join must not blank the page. */
const soft = async <T,>(url: string): Promise<T[]> => {
  try {
    const { data } = await axiosInstance.get<T[]>(url);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Liquidated damages accrue once a work order runs past its end date without completing.
// 0.5%/week of contract value, capped at 10% — the ceiling the LD terms describe.
const LD_WEEKLY_RATE = 0.005;
const LD_CAP = 0.10;

const computeLd = (budget: number, endDate: string, status: string) => {
  if (!endDate || status === 'Completed') return { ldAmount: 0, ldStatus: '' };
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end) || end >= Date.now()) return { ldAmount: 0, ldStatus: '' };
  const weeksLate = Math.floor((Date.now() - end) / (7 * 24 * 60 * 60 * 1000));
  if (weeksLate < 1) return { ldAmount: 0, ldStatus: '' };
  const ldAmount = Math.min(budget * LD_WEEKLY_RATE * weeksLate, budget * LD_CAP);
  return { ldAmount, ldStatus: `Overdue by ${weeksLate} week${weeksLate === 1 ? '' : 's'}` };
};

export const GlobalProjects = () => {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await soft<RawProject>('/projects');
        const [workOrders, vendors, bills] = await Promise.all([
          soft<WorkOrder>('/workorders'),
          soft<Vendor>('/vendors'),
          soft<Bill>('/bills'),
        ]);

        const woById = new Map(workOrders.map(w => [w.id, w]));
        const vendorById = new Map(vendors.map(v => [v.id, v]));

        // Milestones are keyed by work order in ExecutionService; fetch once per project.
        const milestoneLists = await Promise.all(
          raw.map(p => (p.workOrderId ? soft<MilestoneDto>(`/execution/milestones?workOrderId=${p.workOrderId}`) : Promise.resolve([]))),
        );

        setProjects(raw.map((p, i) => {
          const wo = p.workOrderId ? woById.get(p.workOrderId) : undefined;
          const vendor = wo?.vendorId ? vendorById.get(wo.vendorId) : undefined;
          const woBills = bills.filter(b => b.workOrderId === p.workOrderId);
          const budget = p.budget ?? wo?.totalValue ?? 0;
          const utilized = woBills
            .filter(b => b.status === 'Paid')
            .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
          const endDate = wo?.endDate ?? '';
          const status = p.status ?? 'Unknown';

          return {
            id: p.id,
            name: p.name ?? 'Untitled project',
            budget,
            status,
            vendorName: vendor?.name ?? 'Unknown vendor',
            workOrderNo: wo?.workOrderNo ?? '—',
            endDate,
            utilized,
            financialUtilization: budget > 0 ? Math.round((utilized / budget) * 100) : 0,
            pendingBills: woBills.filter(b => b.status !== 'Paid' && b.status !== 'Rejected').length,
            ...computeLd(budget, endDate, status),
            milestones: [...milestoneLists[i]]
              .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
              .map(m => ({
                title: m.title,
                status: m.status,
                weightage: m.weightage,
                completionDate: m.completionDate ?? null,
                targetDate: m.targetDate,
              })),
          };
        }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-8 text-slate-600">Loading projects...</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Project Monitoring</h1>
        <p className="text-slate-600 mt-1">Global view of all active projects — milestones, financial utilization and delays.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {projects.map(proj => (
          <div key={proj.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-lg font-semibold text-slate-800">{proj.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${proj.status === 'Activated' ? 'bg-blue-100 text-blue-700' :
                      proj.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>{proj.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {proj.workOrderNo} · Vendor: <span className="font-medium text-slate-700">{proj.vendorName}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Contract Value</p>
                  <p className="text-xl font-bold text-slate-800">{rupeesCompact(proj.budget)}</p>
                </div>
              </div>

              <div className="mt-6">
                {/* Financial Utilization */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2 text-sm font-medium text-slate-600">
                      <Target className="w-4 h-4" />
                      <span>Financial Utilization</span>
                    </div>
                    <span className="font-bold text-slate-800">{proj.financialUtilization}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${proj.financialUtilization}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{rupeesCompact(proj.utilized)} of {rupeesCompact(proj.budget)} utilized</p>
                </div>
              </div>

              {/* LD Warning */}
              {proj.ldAmount > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-red-700">LD Alert: </span>
                    <span className="text-red-700">{proj.ldStatus}. Estimated LD: {rupees(proj.ldAmount)}</span>
                  </div>
                </div>
              )}

              {/* Milestones */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Milestones</p>
                <div className="space-y-2">
                  {proj.milestones?.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        {m.status === 'Completed'
                          ? <CheckCircle className="w-4 h-4 text-green-700" />
                          : <Clock className="w-4 h-4 text-slate-600" />
                        }
                        <span className={m.status === 'Completed' ? 'text-green-700 font-medium' : 'text-slate-600'}>{m.title}</span>
                        <span className="text-slate-600 text-xs">({m.weightage}%)</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        new Date(m.targetDate) < new Date() ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {m.status === 'Completed' ? 'Done' : `Due ${new Date(m.targetDate).toLocaleDateString()}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {proj.pendingBills > 0 && (
                <div className="mt-3 flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{proj.pendingBills} bill(s) pending approval</span>
                </div>
              )}

              {/* Opens the full project record: contract terms, milestone submission
                  packages, progress reports, documents and bills filed by the vendor. */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                <Link
                  to={`/admin/projects/${proj.id}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  View Details <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No active projects found. Work orders must be accepted by vendors to activate projects.</p>
          </div>
        )}
      </div>
    </div>
  );
};
