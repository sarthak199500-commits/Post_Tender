import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CalendarClock,
  Clock,
  FileSearch,
  Image,
  Send,
  Paperclip
} from 'lucide-react';
import type { RootState } from '../../store';
import axiosInstance, { GATEWAY_BASE } from '../../api/axiosInstance';
import { severityChipClass } from '../../utils/defectSeverity';
import { statusChipClass } from '../../utils/statusTone';

interface Defect {
  id: string;
  description: string;
  severity: string;
  status: string;
  reworkReportUrl?: string;
  rectificationNotes?: string;
  rectifiedAt?: string;
}

interface Inspection {
  id: string;
  projectId: string;
  projectName: string;
  /** The login user id of the inspector, not their profile id — see Create in InspectionsController. */
  inspectorId?: string;
  inspectorName?: string;
  inspectionDate: string;
  remarks: string;
  status: string;
  evidenceUrl?: string;
  defects: Defect[];
}

interface Visit {
  id: string;
  scheduledDate: string;
  purpose: string;
  status: string;
  remarks?: string;
  // Stamped when the list loads — reading the clock during render is not idempotent.
  isOverdue?: boolean;
}

// Only the two values the server can actually produce: it sets "Resolved" once every
// defect is Verified and "Follow-up Required" otherwise. The entity comment also mentions
// Pass/Fail, but no code path ever assigns them.
const INSPECTION_STATUS_STYLES: Record<string, string> = {
  Resolved: statusChipClass('Resolved'),
  'Follow-up Required': statusChipClass('Follow-up Required'),
};

/**
 * What the card header says instead of repeating Inspection.Status, which is just a
 * roll-up of the defect rows printed directly beneath it. A count says something those
 * rows don't: how much is left.
 */
const defectProgress = (defects: Defect[] = []) => {
  const total = defects.length;
  const open = defects.filter(d => d.status === 'Open').length;
  const awaiting = defects.filter(d => d.status === 'Rectified').length;

  if (open > 0) return { label: `${open} of ${total} open`, className: 'bg-amber-100 text-amber-700' };
  if (awaiting > 0) return { label: `${awaiting} awaiting verification`, className: 'bg-amber-100 text-amber-700' };
  return { label: `All ${total} verified`, className: 'bg-emerald-100 text-emerald-700' };
};

export const QualityDefects = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [reworkEvidence, setReworkEvidence] = useState<string>('');
  const [rectificationNotes, setRectificationNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useSelector((state: RootState) => state.auth);

  // Inspection carries only ids — project names live in TenderService, and the inspector is
  // stored as a login user id — so resolve both here, the same way ProgressHistory does.
  const loadInspections = async () => {
    try {
      const [inspectionsRes, projectsRes, inspectorsRes] = await Promise.all([
        axiosInstance.get('/inspections/vendor'),
        axiosInstance.get('/projects').catch(() => ({ data: [] })),
        axiosInstance.get('/inspectors').catch(() => ({ data: [] })),
      ]);

      const projects: { id: string; name?: string }[] = projectsRes.data ?? [];
      const inspectors: { userId?: string; name?: string }[] = inspectorsRes.data ?? [];
      setInspections((inspectionsRes.data ?? []).map((i: Inspection) => ({
        ...i,
        projectName: projects.find(p => p.id === i.projectId)?.name ?? 'Unknown Project',
        inspectorName: inspectors.find(x => x.userId === i.inspectorId)?.name ?? 'Unassigned',
      })));
    } catch (e) { console.error(e); }
  };

  const loadVisits = () => {
    axiosInstance.get('/inspectionvisits/vendor')
      .then(res => {
        const now = Date.now();
        setVisits((res.data ?? []).map((v: Visit) => ({
          ...v,
          isOverdue: new Date(v.scheduledDate).getTime() < now,
        })));
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadInspections();
    loadVisits();
  }, [token]);

  // A visit the inspector never closed out stays "Scheduled" past its date, so sort by date
  // and call those out rather than listing them as upcoming.
  const openVisits = visits
    .filter(v => v.status === 'Scheduled')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

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

  // Every exit path clears the draft, so reopening another defect never inherits
  // the previous one's notes or evidence.
  const closeModal = () => {
      setSelectedDefect(null);
      setReworkEvidence('');
      setRectificationNotes('');
  };

  const handleSubmitRework = async (defectId: string) => {
      if (!reworkEvidence) {
          alert("Please upload evidence of rework.");
          return;
      }

      try {
          await axiosInstance.put(`/inspections/defect/${defectId}/rectify`, {
              reworkReportUrl: reworkEvidence,
              rectificationNotes: rectificationNotes.trim() || null
          });
          alert(`Rework report submitted for defect ${defectId}. PMU will verify shortly.`);
          closeModal();
          loadInspections();
      } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-700" />
          Inspections & Defects
        </h1>
        <p className="text-slate-600 mt-2">Track upcoming site visits, review inspection findings, and submit rectification reports.</p>
      </div>

      {openVisits.length > 0 && (
        <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-brand-50 px-6 py-4 border-b border-brand-100 flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-800">Scheduled Inspection Visits</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {openVisits.map(visit => (
              <div key={visit.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{visit.purpose}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {visit.isOverdue ? 'Was due' : 'Scheduled for'} {new Date(visit.scheduledDate).toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start md:self-auto ${
                  visit.isOverdue ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
                }`}>
                  {visit.isOverdue ? 'Awaiting Visit' : 'Scheduled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {inspections.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-card border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800">Perfect Quality Score!</h2>
            <p className="text-slate-600">No open defects identified across your active projects.</p>
          </div>
        ) : (
          inspections.map(ins => {
            const progress = defectProgress(ins.defects);
            return (
            <div key={ins.id} className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-slate-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-800">{ins.projectName}</h3>
                    <p className="text-xs text-slate-600">{new Date(ins.inspectionDate).toLocaleDateString()} • {ins.remarks}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${progress.className}`}>
                    {progress.label}
                  </span>
                  <button
                    onClick={() => setSelectedInspection(ins)}
                    className="group inline-flex items-center gap-2 border border-slate-300 text-slate-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 text-sm font-semibold px-4 py-2 rounded-control transition-colors"
                  >
                    View Details
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {ins.defects.map(defect => (
                  <div key={defect.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${severityChipClass(defect.severity)}`}>
                          {defect.severity} Severity
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">{defect.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {defect.status === 'Open' ? (
                        <button 
                          onClick={() => setSelectedDefect(defect)}
                          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-control text-sm font-bold hover:bg-brand-700 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          Submit Rectification
                        </button>
                      ) : defect.status === 'Verified' ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-1.5 rounded-control border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-700 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-control border border-amber-100">
                          <Clock className="w-4 h-4" />
                          Under Verification
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Inspection Detail Modal — read-only; rectification is submitted from the card. */}
      {selectedInspection && (
        <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-card shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedInspection.projectName}</h2>
                <p className="text-xs text-slate-600 mt-1">Inspection Report</p>
              </div>
              <button onClick={() => setSelectedInspection(null)} className="text-slate-600 hover:text-slate-800 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${INSPECTION_STATUS_STYLES[selectedInspection.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {selectedInspection.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Inspected On</p>
                  <p className="text-sm text-slate-800 font-medium">{new Date(selectedInspection.inspectionDate).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Inspector</p>
                  <p className="text-sm text-slate-800 font-medium">{selectedInspection.inspectorName}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Inspector's Remarks</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedInspection.remarks || '—'}</p>
              </div>

              {selectedInspection.evidenceUrl && (
                <a
                  href={`${GATEWAY_BASE}${selectedInspection.evidenceUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-2 rounded-control border border-brand-100 hover:bg-brand-100 transition-colors"
                >
                  <Image className="w-3.5 h-3.5" /> View Inspection Evidence
                </a>
              )}

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                  Defects ({selectedInspection.defects?.length ?? 0})
                </p>
                <div className="space-y-3">
                  {(selectedInspection.defects ?? []).map(defect => (
                    <div key={defect.id} className="border border-slate-200 rounded-card p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${severityChipClass(defect.severity)}`}>
                          {defect.severity} Severity
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          defect.status === 'Open' ? 'bg-slate-100 text-slate-600' :
                          defect.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {defect.status}
                        </span>
                        {defect.rectifiedAt && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Submitted {new Date(defect.rectifiedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-800 font-medium">{defect.description}</p>
                      {/* Kept off the card but retained here — the only place the raw id is
                          worth quoting is a support conversation. */}
                      <p className="text-[10px] text-slate-400 font-mono mt-1 break-all">{defect.id}</p>

                      {defect.rectificationNotes && (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-control p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Your Rectification Notes</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{defect.rectificationNotes}</p>
                        </div>
                      )}

                      {defect.reworkReportUrl && (
                        <a
                          href={`${GATEWAY_BASE}${defect.reworkReportUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-control border border-brand-100 hover:bg-brand-100 transition-colors"
                        >
                          <Paperclip className="w-3.5 h-3.5" /> Your Rework Evidence
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedInspection(null)} className="px-6 py-2 rounded-control text-sm font-bold text-slate-600 hover:bg-slate-100">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rework Submission Modal */}
      {selectedDefect && (
        <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-card shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Rectification Report</h2>
                <button onClick={closeModal} className="text-slate-600 hover:text-slate-600">×</button>
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
                     value={rectificationNotes}
                     onChange={(e) => setRectificationNotes(e.target.value)}
                     className="w-full p-4 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                     placeholder="Describe how the defect was corrected..."
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">Evidence of Rework</label>
                   <label className={`block border-2 border-dashed rounded-card p-8 text-center transition-colors cursor-pointer ${
                     reworkEvidence ? 'bg-emerald-50 border-emerald-500' : 'border-slate-200 hover:bg-slate-50'
                   }`}>
                      {reworkEvidence ? (
                         <div className="flex flex-col items-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-700 mb-2" />
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Evidence Attached Successfully</p>
                         </div>
                      ) : (
                         <>
                            <Paperclip className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                {isUploading ? 'Uploading Evidence...' : 'Upload Photos or Documents'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 normal-case">JPG, PNG, PDF or Word</p>
                         </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                   </label>
                </div>
             </div>
             <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
                <button 
                  onClick={() => handleSubmitRework(selectedDefect.id)}
                  className="bg-brand-600 text-white px-6 py-2 rounded-control text-sm font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
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
