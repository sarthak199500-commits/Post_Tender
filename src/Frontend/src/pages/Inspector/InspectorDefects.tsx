import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {  CheckCircle2, ShieldAlert, Plus, Camera, X } from 'lucide-react';
import type { RootState } from '../../store';
import axiosInstance, { GATEWAY_BASE } from '../../api/axiosInstance';
import { DEFECT_SEVERITIES, severityChipClass } from '../../utils/defectSeverity';

interface ProjectOption {
  id: string;
  name: string;
  workOrderId?: string;
}

interface Defect {
  id: string;
  description: string;
  severity: string;
  status: string;
  reworkReportUrl?: string;
  rectificationNotes?: string;
}

interface Inspection {
  id: string;
  projectId: string;
  /** Composed on the client — Inspection lives in InspectionService, Project does not. */
  projectName?: string;
  inspectionDate: string;
  remarks: string;
  status: string;
  defects: Defect[];
}

export const InspectorDefects = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLogging, setIsLogging] = useState(false);
  const [newInspection, setNewInspection] = useState({
      projectId: '',
      remarks: '',
      evidenceUrl: '',
      defects: [] as { description: string, severity: string }[]
  });
  const [newDefect, setNewDefect] = useState({ description: '', severity: 'Medium' });
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useSelector((state: RootState) => state.auth);

  const loadData = async () => {
      // Fetched independently: a failure on either one must not blank the other, and the
      // project list is what supplies the names the inspections themselves don't carry.
      const [insRes, projRes] = await Promise.all([
          axiosInstance.get<Inspection[]>('/inspections/inspector').catch(err => { console.error(err); return { data: [] as Inspection[] }; }),
          axiosInstance.get<ProjectOption[]>('/projects').catch(err => { console.error(err); return { data: [] as ProjectOption[] }; }),
      ]);

      const nameById = new Map(projRes.data.map(p => [p.id, p.name]));
      setProjects(projRes.data);
      setInspections(insRes.data.map(i => ({
          ...i,
          projectName: i.projectName ?? nameById.get(i.projectId) ?? 'Unknown project',
      })));
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
          // InspectionService stores VendorId denormalized so the vendor's own defect
          // worklist can be scoped without a cross-service call. The vendor is on the
          // work order (TenderService), so resolve it here and send it with the payload —
          // without it the vendor would never see the defect they have to rectify.
          const project = projects.find(p => p.id === newInspection.projectId);
          let vendorId = '';
          if (project?.workOrderId) {
              const { data: wo } = await axiosInstance.get<{ vendorId?: string }>(`/workorders/${project.workOrderId}`);
              vendorId = wo?.vendorId ?? '';
          }
          if (!vendorId) {
              alert('Could not determine the vendor for this project. The defect would not reach them, so it was not saved.');
              return;
          }

          await axiosInstance.post('/inspections', { ...newInspection, vendorId });
          setIsLogging(false);
          setNewInspection({ projectId: '', remarks: '', evidenceUrl: '', defects: [] });
          loadData();
      } catch (err) {
          console.error(err);
          alert('Failed to log the inspection.');
      }
  };

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
          const { data } = await axiosInstance.post('/files/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          setNewInspection(prev => ({ ...prev, evidenceUrl: data.url }));
      } catch (err) {
          console.error(err);
          alert('Failed to upload the evidence file.');
      } finally { setIsUploading(false); }
  };

  const handleVerifyDefect = async (defectId: string, isVerified: boolean) => {
      try {
          await axiosInstance.put(`/inspections/defect/${defectId}/verify`, { isVerified });
          loadData();
      } catch (err) {
          console.error(err);
          alert(isVerified ? 'Failed to accept the rectification.' : 'Failed to return the rework.');
      }
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
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${severityChipClass(defect.severity)}`}>
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

                                    {defect.rectificationNotes && (
                                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Vendor's Rectification Notes</p>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{defect.rectificationNotes}</p>
                                        </div>
                                    )}

                                    {defect.reworkReportUrl && (
                                        <div className="mt-3">
                                            <a href={`${GATEWAY_BASE}${defect.reworkReportUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
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
          <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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

                  <div>
                      <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Inspection Evidence (optional)</label>
                      <label className={`block border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                          newInspection.evidenceUrl ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200 hover:bg-slate-50'
                      }`}>
                          {newInspection.evidenceUrl ? (
                              <div className="flex flex-col items-center">
                                  <CheckCircle2 className="w-7 h-7 text-emerald-700 mb-2" />
                                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Evidence Attached</p>
                              </div>
                          ) : (
                              <>
                                  <Camera className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                      {isUploading ? 'Uploading Evidence...' : 'Upload Site Photo or Video'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-1">Shared with the vendor on their inspection record</p>
                              </>
                          )}
                          <input
                              type="file"
                              className="hidden"
                              accept="image/*,video/*,.pdf"
                              onChange={handleEvidenceUpload}
                              disabled={isUploading}
                          />
                      </label>
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
                              {DEFECT_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
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
