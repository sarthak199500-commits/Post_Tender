import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  AlertTriangle, 
  CheckCircle2, 
   
  FileSearch, 
  Send,
  Camera
} from 'lucide-react';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';

interface Defect {
  id: string;
  description: string;
  severity: string;
  status: string;
  reworkReportUrl?: string;
  rectifiedAt?: string;
}

interface Inspection {
  id: string;
  projectName: string;
  inspectionDate: string;
  remarks: string;
  status: string;
  defects: Defect[];
}

export const QualityDefects = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [reworkEvidence, setReworkEvidence] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useSelector((state: RootState) => state.auth);

  const loadInspections = () => {
    axiosInstance.get('/inspections/vendor')
      .then(res => setInspections(res.data ?? []))
      .catch(console.error);
  };

  useEffect(() => {
    loadInspections();
  }, [token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await axiosInstance.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReworkEvidence(data.url);
    } catch (e) { console.error(e); }
    finally { setIsUploading(false); }
  };

  const handleSubmitRework = async (defectId: string) => {
      if (!reworkEvidence) {
          alert("Please upload evidence of rework.");
          return;
      }

      try {
          await axiosInstance.put(`/inspections/defect/${defectId}/rectify`, { reworkReportUrl: reworkEvidence });
          alert(`Rework report submitted for defect ${defectId}. PMU will verify shortly.`);
          setSelectedDefect(null);
          setReworkEvidence('');
          loadInspections();
      } catch (e) { console.error(e); }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-700" />
          Quality Defects & Rectification
        </h1>
        <p className="text-slate-600 mt-2">View real-time feedback from the Quality Team and submit rectification reports.</p>
      </div>

      <div className="space-y-6">
        {inspections.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800">Perfect Quality Score!</h2>
            <p className="text-slate-600">No open defects identified across your active projects.</p>
          </div>
        ) : (
          inspections.map(ins => (
            <div key={ins.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-slate-600" />
                  <div>
                    <h3 className="font-bold text-slate-800">{ins.projectName}</h3>
                    <p className="text-xs text-slate-600">{new Date(ins.inspectionDate).toLocaleDateString()} • {ins.remarks}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  Action Required
                </span>
              </div>
              
              <div className="divide-y divide-slate-100">
                {ins.defects.map(defect => (
                  <div key={defect.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          defect.severity === 'High' ? 'bg-red-100 text-red-700' : 
                          defect.severity === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {defect.severity} Severity
                        </span>
                        <span className="text-xs font-bold text-slate-600">ID: {defect.id}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{defect.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {defect.status === 'Open' ? (
                        <button 
                          onClick={() => setSelectedDefect(defect)}
                          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Submit Rectification
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4" />
                          Under Verification
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rework Submission Modal */}
      {selectedDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Rectification Report</h2>
                <button onClick={() => setSelectedDefect(null)} className="text-slate-600 hover:text-slate-600">×</button>
             </div>
             <div className="p-6 space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">Defect Description</p>
                  <p className="text-sm text-slate-800 font-medium">{selectedDefect.description}</p>
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">Rectification Action Taken</label>
                   <textarea 
                     rows={4}
                     className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                     placeholder="Describe how the defect was corrected..."
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">Evidence of Rework</label>
                   <label className={`block border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                     reworkEvidence ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200 hover:bg-slate-50'
                   }`}>
                      {reworkEvidence ? (
                         <div className="flex flex-col items-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-700 mb-2" />
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Evidence Attached Successfully</p>
                         </div>
                      ) : (
                         <>
                            <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                {isUploading ? 'Uploading Evidence...' : 'Upload Site Photos'}
                            </p>
                         </>
                      )}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                   </label>
                </div>
             </div>
             <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setSelectedDefect(null)} className="px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
                <button 
                  onClick={() => handleSubmitRework(selectedDefect.id)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  Submit for Re-inspection
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
