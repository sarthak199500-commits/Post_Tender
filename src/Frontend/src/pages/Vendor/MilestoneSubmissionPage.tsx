import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Milestone as MilestoneIcon,
  Calendar,
  TrendingUp,
  DollarSign,
  FileText,
  Upload,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  Image,
  AlertTriangle,
  Paperclip,
  ChevronDown,
  Eye,
} from 'lucide-react';
import type { RootState } from '../../store';
import axiosInstance, { GATEWAY_BASE as API_BASE } from '../../api/axiosInstance';
import type { Milestone, ProgressReport } from '../../types/domain';

interface SubmissionDocument { id: string; name: string; type?: string; url?: string; size?: string; uploadedAt?: string; }

// /progressreports/project/{id} enriches each report with its milestone (when linked).
type ReportRow = ProgressReport & { milestone?: { title: string } };

/* ─── helpers ──────────────────────────────────────────────────────────── */

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    'Inspection Requested': 'bg-blue-50 text-blue-700 border-blue-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Delayed: 'bg-red-50 text-red-700 border-red-200',
    Draft: 'bg-slate-50 text-slate-600 border-slate-200',
    Submitted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Reviewed: 'bg-sky-50 text-sky-700 border-sky-200',
    Returned: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600 border-slate-200';
};

const DOC_TYPES = ['Completion Certificate', 'Test Report', 'Quality Certificate', 'Other'];

/* ─── component ────────────────────────────────────────────────────────── */

export const MilestoneSubmissionPage = () => {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const isVendor = user?.role === 'Vendor';

  // ── state ──
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [projectName, setProjectName] = useState('');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<SubmissionDocument[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isImmutable, setIsImmutable] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState(DOC_TYPES[0]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isReadOnly = isImmutable || !isVendor;

  // ── load milestone & project data ──
  const loadData = useCallback(async () => {
    if (!milestoneId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let activeProjectId = projectId;

      // Check if a submission already exists
      try {
        const subs = (await axiosInstance.get(`/milestonesubmissions/milestone/${milestoneId}`)).data;
        if (subs.length > 0) {
          const existing = subs[0];
          setSubmissionId(existing.id);
          setNotes(existing.notes || '');
          setSelectedReportIds(new Set((existing.linkedReportIds || []).map((id: string) => id)));
          setDocuments(existing.documents || []);
          setIsImmutable(existing.isImmutable);
          setSubmissionStatus(existing.status);
          if (!activeProjectId) {
            activeProjectId = existing.projectId;
          }
        }
      } catch (err) { console.error(err); }

      if (activeProjectId) {
        // Fetch project (milestones are nested)
        try {
          const proj = (await axiosInstance.get(`/projects/${activeProjectId}`)).data;
          setProjectName(proj.name);
          const ms = proj.workOrder?.milestones?.find((m: { id: string }) => m.id.toLowerCase() === milestoneId.toLowerCase());
          if (ms) setMilestone(ms);
        } catch (err) { console.error(err); }

        // Fetch progress reports for project
        try {
          setReports((await axiosInstance.get(`/progressreports/project/${activeProjectId}`)).data);
        } catch (err) { console.error(err); }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, milestoneId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── toggle report selection ──
  const toggleReport = (id: string) => {
    if (isReadOnly) return;
    setSelectedReportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── save draft ──
  const handleSaveDraft = async () => {
    if (isReadOnly) return;
    setSaving(true);
    try {
      if (submissionId) {
        // Update existing
        await axiosInstance.put(`/milestonesubmissions/${submissionId}`, {
          notes,
          linkedReportIds: Array.from(selectedReportIds),
        });
      } else {
        // Create new
        const sub = (await axiosInstance.post('/milestonesubmissions', {
          milestoneId,
          projectId,
          notes,
          linkedReportIds: Array.from(selectedReportIds),
        })).data;
        setSubmissionId(sub.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── submit (finalize) ──
  const handleSubmit = async () => {
    if (isReadOnly) return;
    if (!window.confirm('Once submitted, this cannot be edited. Are you sure you want to finalize this milestone submission?'))
      return;

    setSubmitting(true);
    try {
      // Save first if needed
      await handleSaveDraft();

      if (!submissionId) return;

      await axiosInstance.post(`/milestonesubmissions/${submissionId}/submit`);
      setIsImmutable(true);
      setSubmissionStatus('Submitted');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to submit the milestone package.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── upload document ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly || !submissionId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      // Upload file via FilesController
      const formData = new FormData();
      formData.append('file', file);
      let fileUrl = '';
      try {
        const uploadData = (await axiosInstance.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })).data;
        fileUrl = uploadData.url || uploadData.filePath || '';
      } catch (err) { console.error(err); }

      // Add document record to submission
      const doc = (await axiosInstance.post(`/milestonesubmissions/${submissionId}/documents`, {
        name: file.name,
        type: uploadDocType,
        url: fileUrl || `uploaded/${file.name}`,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      })).data;
      setDocuments(prev => [...prev, doc]);
    } catch (err) {
      console.error(err);
      alert('Failed to attach the document.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── remove document ──
  const handleRemoveDocument = async (docId: string) => {
    if (isReadOnly || !submissionId) return;
    try {
      await axiosInstance.delete(`/milestonesubmissions/${submissionId}/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) { console.error(err); }
  };

  /* ─── loading / error states ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading milestone details...</p>
        </div>
      </div>
    );
  }

  if (!milestone) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-700 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Milestone not found.</p>
          <button onClick={() => navigate('/vendor/milestones')} className="text-blue-700 text-sm font-bold mt-4 hover:underline">
            ← Back to Milestones
          </button>
        </div>
      </div>
    );
  }

  /* ─── render ─────────────────────────────────────────────────────────── */

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Back button ── */}
        <button
          onClick={() => navigate(-1)}
          className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1"
        >
          &larr; Back
        </button>

        {/* ── Page title ── */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <MilestoneIcon className="w-8 h-8 text-blue-700" />
            Milestone Submission
          </h1>
          <p className="text-slate-600 mt-1">
            {!isVendor
              ? 'Viewing submission evidence package for this milestone.'
              : isImmutable
              ? 'This submission has been finalized and is read-only.'
              : 'Prepare your milestone completion package for inspection.'}
          </p>
        </div>

        {/* ── Submitted status banner ── */}
        {isReadOnly && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <p className="font-bold text-emerald-800">
                {isVendor ? 'Submission Finalized' : 'Milestone Submission Package'}
              </p>
              <p className="text-sm text-emerald-700">
                Status: <strong>{submissionStatus || 'Inspection Requested'}</strong> — This record is read-only.
              </p>
            </div>
          </div>
        )}

        {/* ─────────────── MILESTONE HEADER ─────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-indigo-600 px-6 py-5 text-white">
            <h2 className="text-xl font-bold">{milestone.title}</h2>
            <p className="text-blue-100 text-sm mt-1">{projectName}</p>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Weightage</p>
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                {milestone.weightage}%
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Payment</p>
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                {milestone.paymentPercentage}%
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Target Date</p>
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Calendar className="w-4 h-4 text-orange-500" />
                {fmtDate(milestone.targetDate)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusColor(milestone.status)}`}>
                {milestone.status === 'Completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {milestone.status}
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────── LINKED PROGRESS REPORTS ─────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Linked Progress Reports</h2>
                <p className="text-xs text-slate-600">Select reports that support this milestone completion</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
              {selectedReportIds.size} selected
            </span>
          </div>

          <div className="divide-y divide-slate-50">
            {reports.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-600 text-sm">No progress reports found for this project.</p>
              </div>
            ) : (
              reports.map(r => {
                const checked = selectedReportIds.has(r.id);
                const expanded = expandedReport === r.id;
                return (
                  <div key={r.id} className={`transition-colors ${checked ? 'bg-blue-50/40' : ''}`}>
                    <div
                      className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/60"
                      onClick={() => toggleReport(r.id)}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        isReadOnly ? ' cursor-default' : 'cursor-pointer'
                      } ${checked ? 'bg-blue-700 border-blue-700' : 'border-slate-300'}`}>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {/* Report info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-sm text-slate-800 truncate">
                            {r.workDescription ? r.workDescription.substring(0, 80) + (r.workDescription.length > 80 ? '...' : '') : 'Progress Report'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDate(r.reportedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {r.milestone?.title || 'N/A'}
                          </span>
                          {r.latitude && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {r.latitude.toFixed(2)}, {(r.longitude ?? 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusColor(r.status)}`}>
                        {r.status}
                      </span>

                      {/* Expand button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedReport(expanded ? null : r.id); }}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="px-6 pb-4 pl-16 space-y-3">
                        {r.workDescription && (
                          <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Work Description</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{r.workDescription}</p>
                          </div>
                        )}
                        {r.mediaUrls && r.mediaUrls.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Evidence Media</p>
                            <div className="flex gap-2 flex-wrap">
                              {r.mediaUrls.map((url: string, i: number) => (
                                <div key={i} className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                                  {url.startsWith('/') || url.startsWith('http') ? (
                                    <img src={url.startsWith('/') ? `${API_BASE}${url}` : url} alt="evidence" className="w-full h-full object-cover" />
                                  ) : (
                                    <Image className="w-5 h-5 text-slate-300" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─────────────── SUPPORTING DOCUMENTS ─────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="bg-amber-50 p-2 rounded-lg">
              <Paperclip className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Supporting Documents</h2>
              <p className="text-xs text-slate-600">Upload completion certificates, test reports, quality certificates</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Existing documents */}
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shrink-0">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{doc.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-600 font-medium">
                    <span className="bg-slate-200/60 px-2 py-0.5 rounded-full">{doc.type}</span>
                    <span>{doc.size}</span>
                    {doc.uploadedAt && <span>{fmtDate(doc.uploadedAt)}</span>}
                  </div>
                </div>
                {doc.url && (
                  <a
                    href={doc.url.startsWith('/') ? `${API_BASE}${doc.url}` : doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 hover:bg-slate-200/60 rounded-lg transition-colors"
                    title="View document"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                  </a>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => handleRemoveDocument(doc.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-600 hover:text-red-700"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Upload area */}
            {!isReadOnly && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6">
                {!submissionId ? (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 font-medium">Save a draft first to upload documents</p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <select aria-label="Select an option"
                      value={uploadDocType}
                      onChange={e => setUploadDocType(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {DOC_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <label className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <Upload className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-bold text-slate-600">
                        {uploading ? 'Uploading...' : 'Choose File'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {documents.length === 0 && isReadOnly && (
              <div className="text-center py-6">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-600 text-sm">No documents were attached to this submission.</p>
              </div>
            )}
          </div>
        </div>

        {/* ─────────────── SUBMISSION NOTES ─────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="bg-violet-50 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Submission Notes</h2>
              <p className="text-xs text-slate-600">Describe the work accomplished for this milestone</p>
            </div>
          </div>
          <div className="p-6">
            {isReadOnly ? (
              <div className="bg-slate-50 rounded-xl p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[80px]">
                {notes || <span className="text-slate-600 italic">No notes provided.</span>}
              </div>
            ) : (
              <textarea
                rows={5}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe the work completed, any challenges overcome, and key deliverables for this milestone..."
                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm leading-relaxed resize-none"
              />
            )}
          </div>
        </div>

        {/* ─────────────── ACTION BUTTONS ─────────────── */}
        {!isReadOnly && (
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedReportIds.size === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled: disabled:shadow-none"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Submit for Inspection
            </button>
          </div>
        )}

        {!isReadOnly && (
          <p className="text-[10px] text-slate-600 text-center uppercase tracking-widest font-bold pb-4">
            ⚠️ Once submitted, this milestone package becomes immutable and cannot be edited.
          </p>
        )}
      </div>
    </div>
  );
};
