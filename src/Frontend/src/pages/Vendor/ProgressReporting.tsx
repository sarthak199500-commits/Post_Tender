import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Camera,
  MapPin,
  Save,
  History,
  FileText,
  Video,
  Trash2,
  X,
  
  Plus,
} from 'lucide-react';
import type { RootState } from '../../store';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import type { Project, Milestone, ProgressReport } from '../../types/domain';
import { statusChipClass } from '../../utils/statusTone';
import { ModalPortal } from '../../components/ModalPortal';

// /progressreports/project/{id} enriches rows with the project name and linked milestone.
type SubmissionRow = ProgressReport & { projectName?: string; milestone?: { title: string }; milestoneTitle?: string };

// Still needed for evidence media rendered via <img src>/<video src>, which cannot go
// through axios. Mirrors axiosInstance's base so this is not pinned to localhost.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5249';
const MAX_MEDIA = 10;
const PREVIEW_COUNT = 3; // show up to 3 thumbnails; 3rd becomes the "+N" tile

// ─── helpers ────────────────────────────────────────────────────────────────

/*
 * The labels are specific to progress reporting — they name who acted, not just the
 * state — so they stay local. The colours come from the shared tone map, so
 * "Reviewed" is no longer sky here and brand everywhere else, and an unrecognised
 * status reads as neutral rather than as a warning.
 */
const REPORT_STATUS_LABELS: Record<string, string> = {
  approved: 'Approved by Dept',
  reviewed: 'Reviewed by Inspector',
  returned: 'Returned for Rework',
  queryraised: 'Query Raised',
  submitted: 'Submitted',
};

const statusMeta = (status?: string) => {
  const raw = status ?? 'Submitted';
  const key = raw.toLowerCase().replace(/[\s_-]/g, '');
  return { label: REPORT_STATUS_LABELS[key] ?? raw, cls: statusChipClass(raw, 'soft') };
};

const isVideo = (url: string) => /\.(mp4|webm|ogg)$/i.test(url);

// ─── sub-components ─────────────────────────────────────────────────────────

/** A single media tile (photo or video icon) */
const MediaTile = ({
  url,
  onDelete,
  onClick,
}: {
  url: string;
  onDelete?: () => void;
  onClick?: () => void;
}) => (
  <div
    className="aspect-square rounded-card bg-slate-100 overflow-hidden relative group border border-slate-200 cursor-pointer"
    onClick={onClick}
  >
    {isVideo(url) ? (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white">
        <Video className="w-8 h-8" />
      </div>
    ) : (
      <img src={`${API_BASE}${url}`} alt="upload" className="w-full h-full object-cover" />
    )}
    {onDelete && (
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-1 right-1 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

/** Overflow "+N" tile */
const OverflowTile = ({ count, onClick }: { count: number; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="aspect-square rounded-card bg-slate-700 text-white flex flex-col items-center justify-center font-black text-xl border border-slate-600 hover:bg-slate-600 transition-colors"
  >
    <Plus className="w-5 h-5 mb-0.5" />
    <span>+{count}</span>
  </button>
);

// ─── main component ──────────────────────────────────────────────────────────

export const ProgressReporting = () => {
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [workDescription, setWorkDescription] = useState('');
  const [descError, setDescError] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // ── data ──────────────────────────────────────────────────────────────────

  // /api/vendordashboard/summary has no controller and no gateway route. /projects is
  // now scoped to the caller's own vendor, so this returns exactly this vendor's projects.
  useEffect(() => {
    axiosInstance
      .get('/projects')
      .then((r) => setProjects(r.data ?? []))
      .catch((err) => console.error('Error loading projects:', err));
  }, [token]);

  const loadSubmissions = (projectId: string) => {
    axiosInstance
      .get(`/progressreports/project/${projectId}`)
      .then((r) => setSubmissions(r.data ?? []))
      .catch((err) => console.error('Error loading submissions:', err));
  };

  useEffect(() => {
    if (selectedProject) {
      loadSubmissions(selectedProject.id);

      // Milestones are owned by ExecutionService and keyed by workOrderId; TenderService's
      // Project has no milestones navigation, so the old d.workOrder?.milestones was always
      // undefined and this dropdown was always empty. Resolve them via the project's
      // workOrderId instead.
      const workOrderId = selectedProject.workOrderId;
      if (!workOrderId) { setMilestones([]); return; }

      axiosInstance
        .get('/execution/milestones', { params: { workOrderId } })
        .then((r) => setMilestones(r.data ?? []))
        .catch((err) => console.error('Error loading milestones:', err));
    } else {
      setMilestones([]);
      setSelectedMilestoneId('');
    }
  }, [selectedProject]);

  // ── upload ────────────────────────────────────────────────────────────────

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_MEDIA - mediaUrls.length;
    if (remaining <= 0) {
      alert(`Maximum ${MAX_MEDIA} media files allowed.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setIsUploading(true);
    for (const file of toUpload) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        // Let the browser set the multipart boundary; axiosInstance defaults to
        // application/json, which would corrupt the upload.
        const res = await axiosInstance.post('/files/upload', fd, {
          headers: { 'Content-Type': undefined },
        });
        setMediaUrls((prev) => [...prev, res.data.url]);
      } catch (e) {
        console.error(e);
      }
    }
    setIsUploading(false);
  };

  // ── location ──────────────────────────────────────────────────────────────

  const handleCaptureLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  };

  // ── submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!workDescription.trim()) {
      setDescError(true);
      return;
    }
    setDescError(false);

    if (!selectedProject || !location) {
      alert('Please select a project and capture GPS location.');
      return;
    }

    // physicalPercentage is deliberately not sent: there is no such measure in this
    // system. The field still exists on the ExecutionService DTO, where it defaults to 0.
    const report = {
      projectId: selectedProject.id,
      milestoneId: selectedMilestoneId || null,
      workDescription,
      latitude: location.lat,
      longitude: location.lng,
      reportingDate: new Date().toISOString(),
      mediaUrls,
    };

    try {
      await axiosInstance.post('/progressreports', report);
      alert('Progress report submitted successfully!');
      setWorkDescription('');
      setLocation(null);
      setMediaUrls([]);
      setSelectedMilestoneId('');
      if (selectedProject) loadSubmissions(selectedProject.id);
    } catch (e) {
      alert((isAxiosError(e) && typeof e.response?.data === 'string' && e.response.data) || 'Failed to submit progress report.');
      console.error(e);
    }
  };

  // ── media preview logic ───────────────────────────────────────────────────
  // Show first 2 as normal tiles; 3rd slot → either the 3rd item or the "+N" overflow tile
  const showOverflow = mediaUrls.length > PREVIEW_COUNT;
  const previewUrls = showOverflow ? mediaUrls.slice(0, PREVIEW_COUNT - 1) : mediaUrls.slice(0, PREVIEW_COUNT);
  const overflowCount = mediaUrls.length - (PREVIEW_COUNT - 1); // count hidden behind "+N"

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-brand-700" />
            Field Progress Reporting
          </h1>
          <p className="text-slate-600 mt-2">Submit daily/weekly work updates with geo-tagged evidence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* ── Left: Form ── */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 space-y-6">
              {/* Project Select */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Active Project</label>
                <select aria-label="Select an option"
                  className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) ?? null)}
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Milestone + GPS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Link to Milestone (Optional)</label>
                  <select aria-label="Select an option"
                    className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white font-medium text-slate-700"
                    value={selectedMilestoneId}
                    onChange={(e) => setSelectedMilestoneId(e.target.value)}
                  >
                    <option value="">N/A (Not linked to a specific milestone)</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">GPS Verification</label>
                  <button
                    onClick={handleCaptureLocation}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-card border-2 transition-all ${
                      location
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'border-dashed border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin className={`w-5 h-5 ${location ? 'text-emerald-700' : ''}`} />
                    {location
                      ? `Captured: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                      : 'Capture Site Location'}
                  </button>
                </div>
              </div>

              {/* Work Description — mandatory */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Work Description <span className="text-red-700">*</span>
                </label>
                <textarea
                  rows={4}
                  className={`w-full p-4 border rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm transition-colors ${
                    descError ? 'border-red-400 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Detail the work performed during this reporting period..."
                  value={workDescription}
                  onChange={(e) => {
                    setWorkDescription(e.target.value);
                    if (e.target.value.trim()) setDescError(false);
                  }}
                />
                {descError && (
                  <p className="mt-1 text-xs text-red-700 font-semibold flex items-center gap-1">
                    ⚠ Work Description is required before submitting.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => { setWorkDescription(''); setLocation(null); setMediaUrls([]); setDescError(false); setSelectedMilestoneId(''); }}
                  className="px-6 py-3 rounded-card font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSubmit}
                  className="bg-brand-600 text-white px-8 py-3 rounded-card font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Submit Report
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Media + Submissions ── */}
          <div className="space-y-6">
            {/* Media Evidence */}
            <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-slate-600" />
                Media Evidence
                <span className="ml-auto text-xs text-slate-600 font-normal">{mediaUrls.length}/{MAX_MEDIA}</span>
              </h2>

              {/* Preview grid — always 3 slots */}
              {mediaUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {previewUrls.map((url, i) => (
                    <MediaTile
                      key={i}
                      url={url}
                      onDelete={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      onClick={() => setMediaModalOpen(true)}
                    />
                  ))}
                  {showOverflow && (
                    <OverflowTile count={overflowCount} onClick={() => setMediaModalOpen(true)} />
                  )}
                </div>
              )}

              {/* Upload buttons */}
              {mediaUrls.length < MAX_MEDIA && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-card flex flex-col items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold uppercase">
                      {isUploading ? 'Uploading...' : 'Photo'}
                    </span>
                    <input
                      ref={photoRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                      disabled={isUploading}
                    />
                  </label>
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-card flex flex-col items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
                    <Video className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold uppercase">
                      {isUploading ? 'Uploading...' : 'Video'}
                    </span>
                    <input
                      ref={videoRef}
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              )}

              <p className="text-[10px] text-slate-600 mt-4 leading-tight italic">
                * Note: All uploads are automatically timestamped and watermarked with site coordinates.
              </p>
            </div>

            {/* Recent Submissions */}
            <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-600" />
                  Recent Submissions
                </h2>
                <button
                  onClick={() => navigate('/vendor/progress/history')}
                  className="text-xs text-brand-700 hover:text-brand-800 font-semibold flex items-center gap-1 hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {submissions.map((sub) => {
                  const { label, cls } = statusMeta(sub.status);
                  const projectName =
                    sub.projectName ??
                    projects.find((p) => p.id === sub.projectId)?.name ??
                    'Unknown Project';
                  return (
                    <button
                      key={sub.id}
                      onClick={async () => {
                        try {
                          const res = await axiosInstance.get(`/progressreports/${sub.id}`);
                          setSelectedSubmission(res.data);
                        } catch {
                          // Fall back to the row we already have rather than blanking the panel.
                          setSelectedSubmission(sub);
                        }
                      }}
                      className="w-full flex gap-3 text-xs p-3 rounded-card hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 text-left"
                    >
                      <div className="w-8 h-8 rounded-control bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-slate-700 truncate">
                            WPR_#{sub.id.substring(0, 8).toUpperCase()}
                          </p>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
                            {label}
                          </span>
                        </div>
                        <p className="text-slate-600 font-semibold truncate">{projectName}</p>
                        <p className="text-slate-600">
                          {new Date(sub.reportedAt).toLocaleDateString()}
                          {sub.milestone?.title && ` · Milestone: ${sub.milestone.title}`}
                          {!sub.milestone?.title && sub.milestoneTitle && ` · Milestone: ${sub.milestoneTitle}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
                {submissions.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4 italic">
                    No recent submissions for this project.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Media Gallery Modal ─────────────────────────────────────────── */}
      {mediaModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-card shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">
                Media Evidence ({mediaUrls.length}/{MAX_MEDIA})
              </h2>
              <button
                onClick={() => setMediaModalOpen(false)}
                className="text-slate-600 hover:text-slate-600 bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center border border-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto">
              {mediaUrls.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-8">No media attached yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {mediaUrls.map((url, i) => (
                    <MediaTile
                      key={i}
                      url={url}
                      onDelete={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <p className="text-xs text-slate-600">{MAX_MEDIA - mediaUrls.length} slot(s) remaining</p>
              <button
                onClick={() => setMediaModalOpen(false)}
                className="bg-slate-900 text-white px-6 py-2 rounded-card text-sm font-bold hover:bg-slate-800 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ─── Submission Detail Modal ─────────────────────────────────────── */}
      {selectedSubmission && (
        <ModalPortal>
        <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-card shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Progress Report Details</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedSubmission.projectName ??
                    projects.find((p) => p.id === selectedSubmission.projectId)?.name ??
                    'Unknown Project'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusMeta(selectedSubmission.status).cls}`}>
                  {statusMeta(selectedSubmission.status).label}
                </span>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-slate-600 hover:text-slate-600 bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center border border-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Submission Date</p>
                  <p className="text-sm font-bold text-slate-800">{new Date(selectedSubmission.reportedAt).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Linked Milestone</p>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedSubmission.milestone?.title || selectedSubmission.milestoneTitle || <span className="text-slate-600 italic">N/A</span>}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Work Description</p>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-control border border-slate-100">
                  {selectedSubmission.workDescription}
                </p>
              </div>

              <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-control border border-emerald-100">
                <div className="w-10 h-10 bg-white rounded-card flex items-center justify-center text-emerald-700 shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest">GPS Coordinates</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {(selectedSubmission.latitude ?? 0).toFixed(6)}, {(selectedSubmission.longitude ?? 0).toFixed(6)}
                  </p>
                </div>
              </div>

              {selectedSubmission.remarks && (
                <div className="mt-4 p-4 bg-amber-50 text-amber-950 rounded-control border border-amber-100 border-dashed animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest mb-1.5">Review Remarks / Return Reason</p>
                  <p className="text-sm font-semibold italic text-slate-700">"{selectedSubmission.remarks}"</p>
                </div>
              )}

              {(selectedSubmission.mediaUrls?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Evidence Gallery</p>
                  <div className="grid grid-cols-3 gap-4">
                    {(selectedSubmission.mediaUrls ?? []).map((url: string, i: number) => (
                      <div key={i} className="aspect-square rounded-control bg-slate-100 overflow-hidden border border-slate-200 shadow-sm">
                        {isVideo(url) ? (
                          <video src={`${API_BASE}${url}`} className="w-full h-full object-cover" controls />
                        ) : (
                          <img src={`${API_BASE}${url}`} alt="Evidence" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500 cursor-zoom-in" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="bg-slate-900 text-white px-8 py-2.5 rounded-card text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
