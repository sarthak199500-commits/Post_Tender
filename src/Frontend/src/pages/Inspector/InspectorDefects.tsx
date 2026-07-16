import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle, CheckCircle2, ShieldAlert, Plus, Camera, X } from 'lucide-react';
import type { RootState } from '../../store';

const API_BASE = 'http://localhost:5249';

interface Defect {
  id: string;
  description: string;
  severity: string;
  status: string;
  reworkReportUrl?: string;
}

interface Inspection {
  id: string;
  projectId: string;
  projectName: string;
  inspectionDate: string;
  remarks: string;
  status: string;
  defects: Defect[];
}

export const InspectorDefects = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLogging, setIsLogging] = useState(false);
  const [newInspection, setNewInspection] = useState({
      projectId: '',
      remarks: '',
      defects: [] as { description: string, severity: string }[]
  });
  const [newDefect, setNewDefect] = useState({ description: '', severity: 'Medium' });
  const { token } = useSelector((state: RootState) => state.auth);

  const loadData = async () => {
      try {
          const insRes = await fetch(`${API_BASE}/api/inspections/inspector`, { headers: { Authorization: `Bearer ${token}` } });
          const insData = await insRes.json();
          setInspections(insData);

          const projRes = await fetch(`${API_BASE}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
          const projData = await projRes.json();
          setProjects(projData);
      } catch (err) { console.error(err); }
  };

  useEffect(() => { loadData(); }, [token]);

  const handleAddDefect = () => {
      if (!newDefect.description) return;
      setNewInspection(prev => ({
          ...prev,
          defects: [...prev.defects, { ...newDefect }]
      }));
      setNewDefect({ description: '', severity: 'Medium' });
  };

  const handleRemoveDefect = (index: number) => {
      setNewInspection(prev => ({
          ...prev,
          defects: prev.defects.filter((_, i) => i !== index)
      }));
  };

  const handleSubmitInspection = async () => {
      if (!newInspection.projectId || !newInspection.remarks || newInspection.defects.length === 0) {
          alert('Project, remarks, and at least one defect are required.');
          return;
      }
      try {
          const res = await fetch(`${API_BASE}/api/inspections`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify(newInspection)
          });
          if (res.ok) {
              setIsLogging(false);
              setNewInspection({ projectId: '', remarks: '', defects: [] });
              loadData();
          }
      } catch (err) { console.error(err); }
  };

  const handleVerifyDefect = async (defectId: string, isVerified: boolean) => {
      try {
          const res = await fetch(`${API_BASE}/api/inspections/defect/${defectId}/verify`, {
              method: 'PUT',
              headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify({ isVerified })
          });
          if (res.ok) loadData();
      } catch (err) { console.error(err); }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-600" />
            Quality Control & Defects
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Log non-compliance issues and verify vendor rectification reports.</p>
        </div>
        <button 
          onClick={() => setIsLogging(true)}
          className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
        >
          <Plus className="w-5 h-5" />
          Log Quality Defect
        </button>
      </div>

      <div className="space-y-6">
        {inspections.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
                <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-800">No Defects Logged</h2>
                <p className="text-slate-600 font-medium">You haven't logged any quality defects recently.</p>
            </div>
        ) : (
            inspections.map(ins => (
                <div key={ins.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">{ins.projectName}</h3>
                            <p className="text-xs text-slate-600 font-medium mt-1">Logged: {new Date(ins.inspectionDate).toLocaleDateString()} • {ins.remarks}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            ins.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {ins.status}
                        </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {ins.defects.map(defect => (
                            <div key={defect.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                            defect.severity === 'High' ? 'bg-rose-100 text-rose-700' : 
                                            defect.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {defect.severity} Severity
                                        </span>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                            defect.status === 'Open' ? 'bg-slate-100 text-slate-600' :
                                            defect.status === 'Rectified' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            {defect.status}
                                        </span>
                                    </div>
                                    <p className="text-slate-800 font-medium">{defect.description}</p>
                                    
                                    {defect.reworkReportUrl && (
                                        <div className="mt-3">
                                            <a href={`http://localhost:5249${defect.reworkReportUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                                                <Camera className="w-3.5 h-3.5" /> View Rework Evidence
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {defect.status === 'Rectified' && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleVerifyDefect(defect.id, true)}
                                            className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                        >
                                            Accept & Close
                                        </button>
                                        <button 
                                            onClick={() => handleVerifyDefect(defect.id, false)}
                                            className="bg-white text-rose-600 border border-rose-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-rose-50 transition-colors"
                                        >
                                            Reject Rework
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      {isLogging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h2 className="text-xl font-bold text-slate-800">Log Quality Defects</h2>
                  <button onClick={() => setIsLogging(false)} className="text-slate-600 hover:text-slate-600 bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center border border-slate-100">✕</button>
               </div>
               
               <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Project / Work Order</label>
                          <select aria-label="Select an option" 
                              value={newInspection.projectId}
                              onChange={e => setNewInspection({...newInspection, projectId: e.target.value})}
                              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-medium bg-slate-50"
                          >
                              <option value="">Select Project...</option>
                              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Overall Remarks</label>
                          <input 
                              type="text"
                              value={newInspection.remarks}
                              onChange={e => setNewInspection({...newInspection, remarks: e.target.value})}
                              placeholder="e.g. Site Visit Findings"
                              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-medium bg-slate-50"
                          />
                      </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                      <h3 className="font-bold text-slate-800 mb-4">Add Defect Item</h3>
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <input 
                                  type="text"
                                  value={newDefect.description}
                                  onChange={e => setNewDefect({...newDefect, description: e.target.value})}
                                  placeholder="Describe the defect..."
                                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                              />
                          </div>
                          <select aria-label="Select an option" 
                              value={newDefect.severity}
                              onChange={e => setNewDefect({...newDefect, severity: e.target.value})}
                              className="w-32 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-medium"
                          >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                          </select>
                          <button 
                              onClick={handleAddDefect}
                              className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                          >
                              Add
                          </button>
                      </div>
                  </div>

                  {newInspection.defects.length > 0 && (
                      <div className="space-y-2">
                          <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Defects to Log ({newInspection.defects.length})</h3>
                          {newInspection.defects.map((d, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                  <div className="flex items-center gap-3">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600">{d.severity}</span>
                                      <span className="text-sm font-medium text-slate-700">{d.description}</span>
                                  </div>
                                  <button onClick={() => handleRemoveDefect(i)} className="text-red-700 hover:bg-red-50 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
                              </div>
                          ))}
                      </div>
                  )}
               </div>

               <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button onClick={() => setIsLogging(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button 
                    onClick={handleSubmitInspection}
                    className="bg-rose-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                  >
                    Submit Inspection
                  </button>
               </div>
            </div>
          </div>
      )}
    </div>
  );
};
