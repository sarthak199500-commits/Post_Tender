import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  Milestone, 
  CheckCircle2, 
  Clock, 
  Calendar,
  AlertCircle,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';
import type { Project, Milestone as MilestoneRow } from '../../types/domain';

export const MilestoneUpdates = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const { token } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  const [loadingMilestones, setLoadingMilestones] = useState(false);

  useEffect(() => {
    axiosInstance.get('/projects')
      .then(({ data }) => setProjects(data))
      .catch(console.error);
  }, [token]);

  // Milestones are owned by ExecutionService and keyed by work order — TenderService's
  // Project has no milestones navigation, so reading `project.milestones` (as this page
  // used to) was always undefined and the list was permanently empty. Resolve through
  // the project's workOrderId instead, the same way ProgressReporting does.
  useEffect(() => {
    if (!selectedProjectId) { setMilestones([]); return; }
    const workOrderId = projects.find(p => p.id === selectedProjectId)?.workOrderId;
    if (!workOrderId) { setMilestones([]); return; }

    let cancelled = false;
    setLoadingMilestones(true);
    axiosInstance.get<MilestoneRow[]>(`/execution/milestones?workOrderId=${workOrderId}`)
      .then(({ data }) => { if (!cancelled) setMilestones(Array.isArray(data) ? data : []); })
      .catch(err => { console.error(err); if (!cancelled) setMilestones([]); })
      .finally(() => { if (!cancelled) setLoadingMilestones(false); });
    return () => { cancelled = true; };
  }, [selectedProjectId, projects]);

  const handlePrepareSubmission = (msId: string) => {
      navigate(`/vendor/milestones/${msId}/submit?projectId=${selectedProjectId}`);
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Milestone className="w-8 h-8 text-emerald-700" />
            Milestone Management
          </h1>
          <p className="text-slate-600 mt-2">Track contractual deliverables and request quality inspections for completed stages.</p>
        </div>

        <div className="flex gap-4 items-center">
           <label className="text-sm font-bold text-slate-600 uppercase tracking-widest">Selected Project:</label>
           <select aria-label="Select an option" 
             className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
             value={selectedProjectId}
             onChange={(e) => setSelectedProjectId(e.target.value)}
           >
             <option value="">Select a project...</option>
             {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
           </select>
        </div>

        {!selectedProjectId ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
             <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-600">Please select a project above to view and manage milestones.</p>
          </div>
        ) : loadingMilestones ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
             <p className="text-slate-600">Loading milestones…</p>
          </div>
        ) : milestones.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
             <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-600">No milestones are defined on this project's work order yet.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {milestones.map((ms, idx) => (
              <div key={ms.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
                 <div className={`w-2 ${ms.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                 <div className="p-6 flex-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex gap-4 items-start">
                       <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 shrink-0">
                          {idx + 1}
                       </div>
                       <div>
                          <h2 className="text-lg font-bold text-slate-800">{ms.title}</h2>
                          <div className="flex items-center gap-4 mt-1 text-xs font-medium">
                             <span className="flex items-center gap-1 text-slate-600">
                                <Calendar className="w-3 h-3" />
                                Target: {new Date(ms.targetDate).toLocaleDateString()}
                             </span>
                             <span className="flex items-center gap-1 text-emerald-700">
                                <TrendingUp className="w-3 h-3" />
                                Weightage: {ms.weightage}%
                             </span>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Status</p>
                          <div className={`flex items-center gap-1.5 font-bold ${ms.status === 'Completed' ? 'text-emerald-700' : 'text-amber-600'}`}>
                             {ms.status === 'Completed' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                             {ms.status}
                          </div>
                       </div>

                       <div className="h-10 w-px bg-slate-100" />

                       {ms.status !== 'Completed' && ms.status !== 'Inspection Requested' ? (
                           <button 
                             onClick={() => handlePrepareSubmission(ms.id)}
                             className="bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
                           >
                              Prepare Submission
                              <ChevronRight className="w-4 h-4" />
                           </button>
                       ) : (
                          <div className="px-5 py-2 text-slate-600 text-sm font-bold flex items-center gap-2 italic">
                             Stage Finalized
                          </div>
                       )}
                    </div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
