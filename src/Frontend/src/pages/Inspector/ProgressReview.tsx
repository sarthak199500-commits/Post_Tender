import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../../store';

interface ProgressReport {
    id: string;
    workOrderNo: string;
    tenderTitle: string;
    vendorName: string;
    progressPercentage: number;
    submittedAt: string;
    status: string;
    milestoneTitle?: string;
}

const ProgressReview: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [reports, setReports] = useState<ProgressReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // A report only carries projectId/vendorId; the vendor name and the work-order /
        // tender titles live in other services, so we compose them on the client via the
        // project -> work order -> tender chain.
        const fetchReports = async () => {
            try {
                const [reportsRes, vendorsRes, projectsRes, woRes, tendersRes] = await Promise.all([
                    axiosInstance.get('/progressreports/pending-review'),
                    axiosInstance.get('/vendors').catch(() => ({ data: [] })),
                    axiosInstance.get('/projects').catch(() => ({ data: [] })),
                    axiosInstance.get('/workorders').catch(() => ({ data: [] })),
                    axiosInstance.get('/tenders').catch(() => ({ data: [] })),
                ]);

                const vendorById = new Map((vendorsRes.data || []).map((v: any) => [v.id, v]));
                const projectById = new Map((projectsRes.data || []).map((p: any) => [p.id, p]));
                const woById = new Map((woRes.data || []).map((w: any) => [w.id, w]));
                const tenderById = new Map((tendersRes.data || []).map((t: any) => [t.id, t]));

                setReports((reportsRes.data || []).map((r: any) => {
                    const project = projectById.get(r.projectId) as any;
                    const wo = project ? (woById.get(project.workOrderId) as any) : undefined;
                    const tender = wo ? (tenderById.get(wo.tenderId) as any) : undefined;
                    return {
                        ...r,
                        vendorName: (vendorById.get(r.vendorId) as any)?.name || '—',
                        workOrderNo: wo?.workOrderNo || '—',
                        tenderTitle: tender?.title || '—',
                    };
                }));
            } catch (err) {
                console.error('Failed to fetch reports', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [token]);

    if (loading) return <div className="p-10 text-center text-slate-600">Fetching reports for review...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-10">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Review Progress Reports</h1>
                <p className="text-slate-600 mt-2 font-medium">Verify vendor submissions and approve milestone progress.</p>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Project / Vendor</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Linked Milestone</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Submission Date</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {reports.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-5">
                                    <div className="font-bold text-slate-800">{r.tenderTitle}</div>
                                    <div className="text-xs text-blue-700 font-black mt-0.5 uppercase tracking-tighter">{r.vendorName}</div>
                                </td>
                                <td className="px-6 py-5">
                                    <span className="text-sm font-semibold text-slate-600">
                                        {r.milestoneTitle && r.milestoneTitle !== 'N/A' ? r.milestoneTitle : 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="text-sm text-slate-600 font-medium">{new Date(r.submittedAt).toLocaleDateString()}</div>
                                    <div className="text-[10px] text-slate-600 font-bold">{new Date(r.submittedAt).toLocaleTimeString()}</div>
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                        r.status === 'Pending Review' ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <Link to={`/inspector/progress-review/${r.id}`} className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 hover:text-white transition-all inline-block">
                                        Review Details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reports.length === 0 && (
                    <div className="p-20 text-center text-slate-600 font-bold">No reports pending review.</div>
                )}
            </div>
        </div>
    );
};

export default ProgressReview;
