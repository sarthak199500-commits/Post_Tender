import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance, { GATEWAY_BASE } from '../../api/axiosInstance';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

// GET /progressreports/{id} returns a bare report — it carries ids, not the nested
// project/vendor/milestone objects the old shape assumed (those live in other services).
interface ProgressReport {
    id: string;
    projectId: string;
    vendorId?: string;
    workDescription: string;
    latitude: number;
    longitude: number;
    mediaUrls: string[];
    reportedAt: string;
    status: string;
    milestoneId?: string;
}

const ReviewReportDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const [report, setReport] = useState<ProgressReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);
    // Composed from other services (the report carries only ids): project/work order names
    // from TenderService, vendor name from VendorService, milestone title from ExecutionService.
    const [projectName, setProjectName] = useState('');
    const [workOrderNo, setWorkOrderNo] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [milestoneTitle, setMilestoneTitle] = useState('');

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const rep = (await axiosInstance.get(`/progressreports/${id}`)).data;
                setReport(rep);

                let workOrderId: string | undefined;
                try {
                    const proj = (await axiosInstance.get(`/projects/${rep.projectId}`)).data;
                    setProjectName(proj?.name ?? '');
                    workOrderId = proj?.workOrderId;
                } catch { /* project not visible — leave blank */ }

                if (workOrderId) {
                    try {
                        const wo = (await axiosInstance.get(`/workorders/${workOrderId}`)).data;
                        setWorkOrderNo(wo?.workOrderNo ?? '');
                    } catch { /* ignore */ }

                    if (rep.milestoneId) {
                        try {
                            const ms = (await axiosInstance.get('/execution/milestones', { params: { workOrderId } })).data;
                            const m = ((ms ?? []) as { id: string; title: string }[]).find(x => x.id === rep.milestoneId);
                            if (m) setMilestoneTitle(m.title);
                        } catch { /* ignore */ }
                    }
                }

                if (rep.vendorId) {
                    try {
                        const vendors = (await axiosInstance.get('/vendors')).data;
                        const v = ((vendors ?? []) as { id: string; name?: string; authPersonName?: string }[]).find(x => x.id === rep.vendorId);
                        if (v) setVendorName(v.name ?? v.authPersonName ?? '');
                    } catch { /* ignore */ }
                }
            } catch (err) {
                console.error('Failed to fetch report details', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id, token]);

    // The inspector records a recommendation (Accept | Reject) and remarks; the report moves
    // to "Reviewed", which is the precondition the department's approval now checks.
    const handleAction = async (recommendation: string) => {
        setSubmitting(true);
        try {
            await axiosInstance.post(`/progressreports/${id}/review`, { recommendation, remarks });
            navigate('/inspector/progress-review');
        } catch {
            alert('Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const formatMediaUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${GATEWAY_BASE}${url}`;
    };

    if (loading) return <div className="p-10 text-center">Loading report details...</div>;
    if (!report) return <div className="p-10 text-center text-red-700 font-bold">Report not found.</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-10">
                <Link to="/inspector/progress-review" className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1">&larr; Back to Review List</Link>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Review Progress Report</h1>
                <p className="text-slate-600 mt-2 font-medium">Verification for <span className="text-slate-900">{projectName || 'this project'}</span></p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Progress Detail */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-slate-800">Vendor Submission</h2>
                            <span className="text-sm font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                                {milestoneTitle ? `Milestone: ${milestoneTitle}` : 'General Progress (N/A)'}
                            </span>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">Work Description</label>
                                <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">{report.workDescription}</p>
                            </div>
                            
                            {report.mediaUrls.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-3">Evidence Photos (Geo-Tagged)</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {report.mediaUrls.map((url, idx) => (
                                            <a key={idx} href={formatMediaUrl(url)} target="_blank" rel="noreferrer" className="aspect-square rounded-2xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity">
                                                <img src={formatMediaUrl(url)} alt="Evidence" className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <span className="text-2xl">📍</span>
                                <div>
                                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Location Data</div>
                                    <div className="text-sm font-bold text-blue-900">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</div>
                                </div>
                                <a href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`} target="_blank" rel="noreferrer" className="ml-auto text-xs font-black text-blue-700 hover:underline">View on Map</a>
                            </div>
                        </div>
                    </div>

                    {/* Inspector Remarks */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Inspection Remarks</h2>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 transition-all"
                            placeholder="Add your internal remarks, findings or reasons for returning the report..."
                        />
                        
                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => handleAction('Accept')}
                                disabled={submitting}
                                className="flex-1 bg-emerald-700 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:"
                            >
                                {submitting ? 'Processing...' : 'Recommend Approval'}
                            </button>
                            <button
                                onClick={() => handleAction('Reject')}
                                disabled={submitting}
                                className="flex-1 bg-white text-orange-700 border-2 border-orange-100 hover:border-orange-200 font-black py-4 rounded-2xl transition-all active:scale-95 disabled:"
                            >
                                Recommend Rejection
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Report Info */}
                    <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
                        <h2 className="text-slate-600 text-xs font-black uppercase tracking-widest mb-4">Report Metadata</h2>
                        <div className="space-y-4">
                            <div className="py-3 border-b border-white/10">
                                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Submitted By</div>
                                <div className="font-bold text-blue-400">{vendorName || '—'}</div>
                            </div>
                            <div className="py-3 border-b border-white/10">
                                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Date & Time</div>
                                <div className="font-bold">{new Date(report.reportedAt).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="py-3 border-b border-white/10">
                                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Work Order</div>
                                <div className="font-bold">{workOrderNo || '—'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewReportDetail;
