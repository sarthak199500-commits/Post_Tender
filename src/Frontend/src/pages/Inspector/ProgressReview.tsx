import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../../store';
import { statusChipClass } from '../../utils/statusTone';

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
                interface VendorRow { id: string; name?: string; }
                interface ProjectRow { id: string; workOrderId?: string; }
                interface WoRow { id: string; workOrderNo?: string; tenderId?: string; }
                interface TenderRow { id: string; title?: string; }
                interface ReportRow extends ProgressReport { projectId?: string; vendorId?: string; }

                const empty = <T,>() => ({ data: [] as T[] });
                const [reportsRes, vendorsRes, projectsRes, woRes, tendersRes] = await Promise.all([
                    axiosInstance.get<ReportRow[]>('/progressreports/pending-review'),
                    axiosInstance.get<VendorRow[]>('/vendors').catch(empty<VendorRow>),
                    axiosInstance.get<ProjectRow[]>('/projects').catch(empty<ProjectRow>),
                    axiosInstance.get<WoRow[]>('/workorders').catch(empty<WoRow>),
                    axiosInstance.get<TenderRow[]>('/tenders').catch(empty<TenderRow>),
                ]);

                const vendorById = new Map((vendorsRes.data || []).map(v => [v.id, v]));
                const projectById = new Map((projectsRes.data || []).map(p => [p.id, p]));
                const woById = new Map((woRes.data || []).map(w => [w.id, w]));
                const tenderById = new Map((tendersRes.data || []).map(t => [t.id, t]));

                setReports((reportsRes.data || []).map(r => {
                    const project = r.projectId ? projectById.get(r.projectId) : undefined;
                    const wo = project?.workOrderId ? woById.get(project.workOrderId) : undefined;
                    const tender = wo?.tenderId ? tenderById.get(wo.tenderId) : undefined;
                    return {
                        ...r,
                        vendorName: (r.vendorId && vendorById.get(r.vendorId)?.name) || '—',
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

    if (loading) return <div className="text-center text-slate-600">Fetching reports for review...</div>;

    return (
        <div>
            <header className="mb-10">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Review Progress Reports</h1>
                <p className="text-slate-600 mt-2 font-medium">Verify vendor submissions and approve milestone progress.</p>
            </header>

            <div className="bg-white rounded-card shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
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
                                    <div className="text-xs text-brand-700 font-black mt-0.5 uppercase tracking-tighter">{r.vendorName}</div>
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
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${statusChipClass(r.status, 'soft')}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <Link to={`/inspector/progress-review/${r.id}`} className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-control text-xs font-bold hover:bg-brand-700 hover:text-white transition-all inline-block">
                                        Review Details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
                {reports.length === 0 && (
                    <div className="p-20 text-center text-slate-600 font-bold">No reports pending review.</div>
                )}
            </div>
        </div>
    );
};

export default ProgressReview;
