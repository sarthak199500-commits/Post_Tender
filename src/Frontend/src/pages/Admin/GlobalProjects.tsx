import { useEffect, useState } from 'react';
import { Activity, Target, AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { rupees, rupeesCompact } from '../../utils/currency';
import axiosInstance from '../../api/axiosInstance';

interface Project {
  id: string;
  name: string;
  budget: number;
  progress: number;
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

export const GlobalProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    axiosInstance.get<Project[]>('/projects')
      .then(({ data }) => setProjects(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-600">Loading projects...</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Project Monitoring</h1>
        <p className="text-slate-600 mt-1">Global view of all active projects — physical completion vs financial utilization.</p>
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

              <div className="mt-6 grid grid-cols-2 gap-6">
                {/* Physical Progress */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2 text-sm font-medium text-slate-600">
                      <Activity className="w-4 h-4" />
                      <span>Physical Completion</span>
                    </div>
                    <span className="font-bold text-slate-800">{proj.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${proj.progress}%` }} />
                  </div>
                </div>
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
