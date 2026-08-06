import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  MapPin,
  FileText,
  
  X,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import type { RootState } from '../../store';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import { statusChipClass } from '../../utils/statusTone';
import { ModalPortal } from '../../components/ModalPortal';

// Still needed for evidence media rendered via <img src>/<video src>, which cannot go
// through axios. Mirrors axiosInstance's base so this is not pinned to localhost.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5249';

interface Submission {
  id: string;
  projectId: string;
  projectName: string;
  workDescription: string;
  latitude: number;
  longitude: number;
  mediaUrls: string[];
  reportedAt: string;
  status: string;
  milestoneId?: string;
  milestone?: { title: string };
  remarks?: string;
  milestoneTitle?: string;
}

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

export const ProgressHistory = () => {
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection & Detail Modal
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // ProgressReport carries projectId but no projectName — project names live in
  // TenderService — so resolve them here. Without this the PROJECT NAME column renders
  // blank and the filter collapses to a single undefined entry.
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [reportsRes, projectsRes] = await Promise.all([
        axiosInstance.get('/progressreports/my'),
        axiosInstance.get('/projects').catch(() => ({ data: [] })),
      ]);

      const projects: { id: string; name?: string }[] = projectsRes.data ?? [];
      setSubmissions((reportsRes.data ?? []).map((r: Submission) => ({
        ...r,
        projectName: projects.find(p => p.id === r.projectId)?.name ?? 'Unknown Project',
      })));
    } catch (err) {
      setError((isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data) || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchHistory();
    }
  }, [token]);

  // Load detailed report with comments when selected
  const handleSelectSubmission = async (id: string) => {
    try {
      const res = await axiosInstance.get(`/progressreports/${id}`);
      setSelectedSubmission(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Unique project names for filtering
  const projectList = Array.from(new Set(submissions.map(s => s.projectName)));

  // Filtered Submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = sub.workDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sub.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = selectedProject === 'All' || sub.projectName === selectedProject;
    const matchesStatus = selectedStatus === 'All' || sub.status.toLowerCase() === selectedStatus.toLowerCase();
    return matchesSearch && matchesProject && matchesStatus;
  });

  // Calculate high-level stats from history
  const totalSubmissions = submissions.length;
  const returnedCount = submissions.filter(s => s.status.toLowerCase() === 'returned').length;
  const approvedCount = submissions.filter(s => s.status.toLowerCase() === 'approved').length;
  const pendingCount = submissions.filter(s => s.status.toLowerCase() === 'submitted').length;

  if (loading) return <div className="text-slate-600 font-medium">Loading progress history...</div>;
  if (error) return <div className="text-red-700 font-medium">Error: {error}</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/vendor/progress')}
          className="text-brand-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1"
        >
          &larr; Back to Reporter
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
            <History className="w-8 h-8 text-brand-700" />
            Progress Submission History
          </h1>
          <p className="text-slate-600 mt-2 font-medium">View, search, and audit all past field progress updates.</p>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-brand-50 text-brand-700 rounded-card">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Total Reports</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{totalSubmissions}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-card">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Pending Review</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-card">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Reworks Requested</p>
            <p className="text-2xl font-bold text-amber-700 mt-0.5">{returnedCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-card">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase">Fully Approved</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{approvedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-card shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
          <input
            type="text"
            placeholder="Search descriptions, projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
          />
        </div>

        <div className="flex w-full md:w-auto gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="text-slate-600 w-4 h-4" />
            <select aria-label="Select an option"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="p-2.5 border border-slate-200 rounded-card bg-white focus:outline-none text-sm font-semibold text-slate-700 w-full md:w-48"
            >
              <option value="All">All Projects</option>
              {projectList.map(proj => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
          </div>

          <select aria-label="Select an option"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2.5 border border-slate-200 rounded-card bg-white focus:outline-none text-sm font-semibold text-slate-700 w-full md:w-44"
          >
            <option value="All">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Approved">Approved</option>
            <option value="Returned">Returned</option>
            <option value="QueryRaised">Query Raised</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white rounded-card border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <th className="p-4 pl-6">Report ID</th>
              <th className="p-4">Project Name</th>
              <th className="p-4">Linked Milestone</th>
              <th className="p-4">Submission Date</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right pr-6">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSubmissions.map((sub) => {
              const { label, cls } = statusMeta(sub.status);
              return (
                <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 pl-6 font-bold text-slate-700 text-xs">
                    WPR_#{sub.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="p-4 font-semibold text-slate-700 text-sm max-w-xs truncate" title={sub.projectName}>
                    {sub.projectName}
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-semibold text-slate-600">
                      {sub.milestoneTitle && sub.milestoneTitle !== 'N/A' ? sub.milestoneTitle : 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 text-sm">
                    {new Date(sub.reportedAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
                      {label}
                    </span>
                  </td>
                  <td className="p-4 text-right pr-6">
                    <button
                      onClick={() => handleSelectSubmission(sub.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors"
                    >
                      View Report <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredSubmissions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-16 text-center text-slate-600 italic">
                  No submissions match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>

      {/* ─── Detail Modal (Matching ProgressReporting) ─── */}
      {selectedSubmission && (
        <ModalPortal>
        <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-card shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Progress Report Details</h2>
                <p className="text-xs text-slate-600 mt-0.5">{selectedSubmission.projectName}</p>
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
                  <p className="text-base font-bold text-brand-700">
                    {selectedSubmission.milestone?.title || selectedSubmission.milestoneTitle || 'N/A'}
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
                    {selectedSubmission.latitude?.toFixed(6)}, {selectedSubmission.longitude?.toFixed(6)}
                  </p>
                </div>
              </div>

              {selectedSubmission.remarks && (
                <div className="mt-4 p-4 bg-amber-50 text-amber-950 rounded-control border border-amber-100 border-dashed animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest mb-1.5">Review Remarks / Return Reason</p>
                  <p className="text-sm font-semibold italic text-slate-700">"{selectedSubmission.remarks}"</p>
                </div>
              )}

              {selectedSubmission.mediaUrls?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Evidence Gallery</p>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedSubmission.mediaUrls.map((url: string, i: number) => (
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
