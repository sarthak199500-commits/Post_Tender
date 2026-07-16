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
  ExternalLink,
  Plus,
} from 'lucide-react';
import type { RootState } from '../../store';

const API_BASE = 'http://localhost:5249';
const MAX_MEDIA = 10;
const PREVIEW_COUNT = 3; // show up to 3 thumbnails; 3rd becomes the "+N" tile

// ─── helpers ────────────────────────────────────────────────────────────────

const statusMeta = (status?: string) => {
  const s = (status ?? 'Submitted').toLowerCase();
  if (s === 'approved') {
    return { label: 'Approved by Dept', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (s === 'reviewed') {
    return { label: 'Reviewed by Inspector', cls: 'bg-sky-50 text-sky-600 border-sky-200' };
  }
  if (s === 'returned') {
    return { label: 'Returned for Rework', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
  }
  if (s === 'queryraised') {
    return { label: 'Query Raised', cls: 'bg-red-50 text-red-700 border-red-200' };
  }
  if (s === 'submitted') {
    return { label: 'Submitted', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  return { label: status ?? 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
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
    className="aspect-square rounded-xl bg-slate-100 overflow-hidden relative group border border-slate-200 cursor-pointer"
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
    className="aspect-square rounded-xl bg-slate-700 text-white flex flex-col items-center justify-center font-black text-xl border border-slate-600 hover:bg-slate-600 transition-colors"
  >
    <Plus className="w-5 h-5 mb-0.5" />
    <span>+{count}</span>
  </button>
);

// ─── main component ──────────────────────────────────────────────────────────

export const ProgressReporting = () => {
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [workDescription, setWorkDescription] = useState('');
  const [descError, setDescError] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // ── data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/api/vendordashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setProjects(d.recentProjects ?? []));
  }, [token]);

  const loadSubmissions = (projectId: string) => {
    fetch(`${API_BASE}/api/progressreports/project/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setSubmissions);
  };

  useEffect(() => {
    if (selectedProject) {
      loadSubmissions(selectedProject.id);
      
      // Fetch project details to load milestones
      fetch(`${API_BASE}/api/projects/${selectedProject.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          setMilestones(d.workOrder?.milestones ?? []);
        })
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
        const res = await fetch(`${API_BASE}/api/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          setMediaUrls((prev) => [...prev, data.url]);
        }
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

    const report = {
      projectId: selectedProject.id,
      milestoneId: selectedMilestoneId || null,
      physicalPercentage: 0,
      workDescription,
      latitude: location.lat,
      longitude: location.lng,
      reportingDate: new Date().toISOString(),
      mediaUrls,
    };

    try {
      const res = await fetch(`${API_BASE}/api/progressreports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(report),
      });
      if (res.ok) {
        alert('Progress report submitted successfully!');
        setWorkDescription('');
        setLocation(null);
        setMediaUrls([]);
        setSelectedMilestoneId('');
        if (selectedProject) loadSubmissions(selectedProject.id);
      }
    } catch (e) {
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
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-700" />
            Field Progress Reporting
          </h1>
          <p className="text-slate-600 mt-2">Submit daily/weekly work updates with geo-tagged evidence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* ── Left: Form ── */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              {/* Project Select */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Active Project</label>
                <select aria-label="Select an option"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium text-slate-700"
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
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
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
                  className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition-colors ${
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
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSubmit}
                  className="bg-blue-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
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
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
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
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-600" />
                  Recent Submissions
                </h2>
                <button
                  onClick={() => navigate('/vendor/progress/history')}
                  className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
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
                          const res = await fetch(`${API_BASE}/api/progressreports/${sub.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (res.ok) {
                            setSelectedSubmission(await res.json());
                          } else {
                            setSelectedSubmission(sub);
                          }
                        } catch (err) {
                          setSelectedSubmission(sub);
                        }
                      }}
                      className="w-full flex gap-3 text-xs p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
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
                className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Submission Detail Modal ─────────────────────────────────────── */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
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
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {selectedSubmission.workDescription}
                </p>
              </div>

              <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-700 shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest">GPS Coordinates</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {selectedSubmission.latitude.toFixed(6)}, {selectedSubmission.longitude.toFixed(6)}
                  </p>
                </div>
              </div>

              {selectedSubmission.remarks && (
                <div className="mt-4 p-4 bg-amber-50 text-amber-950 rounded-2xl border border-amber-100 border-dashed animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest mb-1.5">Review Remarks / Return Reason</p>
                  <p className="text-sm font-semibold italic text-slate-700">"{selectedSubmission.remarks}"</p>
                </div>
              )}

              {selectedSubmission.mediaUrls?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Evidence Gallery</p>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedSubmission.mediaUrls.map((url: string, i: number) => (
                      <div key={i} className="aspect-square rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 shadow-sm">
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
                className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
