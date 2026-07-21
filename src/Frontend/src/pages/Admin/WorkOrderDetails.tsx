import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance, { GATEWAY_BASE } from '../../api/axiosInstance';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AlertCircle } from 'lucide-react';

interface Milestone {
    id: string;
    title: string;
    weightage: number;
    paymentPercentage: number;
    targetDate: string;
    status: string;
}

interface WorkOrder {
    id: string;
    workOrderNo: string;
    tender: { title: string, budget: number, tenderNo: string };
    vendor: { name: string, vendorCode: string, email: string };
    inspector: { name: string, type: string };
    totalValue: number;
    scopeDescription: string;
    paymentTerms: string;
    liquidatedDamagesTerms: string;
    startDate: string;
    endDate: string;
    status: string;
    agreementDocumentUrl: string;
    milestones: Milestone[];
}

export const WorkOrderDetails = () => {
    const { id } = useParams<{ id: string }>();
    const { token, user } = useSelector((state: RootState) => state.auth);
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);
    const [acting, setActing] = useState(false);

    // Confirm dialog state
    const [confirm, setConfirm] = useState<{
        open: boolean;
        title: string;
        message: string;
        label: string;
        variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', label: '', variant: 'warning', onConfirm: () => { } });

    const askConfirm = (cfg: typeof confirm) => setConfirm({ ...cfg, open: true });
    const closeConfirm = () => setConfirm(c => ({ ...c, open: false }));

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get(`/workorders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWo(res.data);

            const reportsRes = await axiosInstance.get(`/progressreports/workorder/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReports(reportsRes.data);
        } catch (err) {
            console.error('Failed to fetch WO details', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [id, token]);

    const handleApproveMilestone = async (milestoneId: string) => {
        if (!window.confirm('Are you sure you want to approve and complete this milestone?')) return;
        try {
            await axiosInstance.post(`/execution/milestones/${milestoneId}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Milestone approved and completed successfully.');
            fetchDetails();
        } catch (err) {
            console.error(err);
            alert('Failed to approve milestone.');
        }
    };

    const handleCancel = async () => {
        setActing(true);
        try {
            await axiosInstance.put(`/workorders/${id}/status`, { newStatus: 'Cancelled' }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDetails();
        } catch (err) {
            alert('Failed to cancel work order');
        } finally {
            setActing(false);
        }
    };

    const formatMediaUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${GATEWAY_BASE}${url}`;
    };

    if (loading) return <div className="p-10 text-center">Loading details...</div>;
    if (!wo) return <div className="p-10 text-center text-red-700 font-bold">Work Order not found.</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <ConfirmDialog
                isOpen={confirm.open}
                title={confirm.title}
                message={confirm.message}
                confirmLabel={confirm.label}
                variant={confirm.variant}
                onConfirm={() => { closeConfirm(); confirm.onConfirm(); }}
                onCancel={closeConfirm}
            />
            <header className="mb-10 flex justify-between items-start">
                <div>
                    <Link to="/admin/work-orders" className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1">&larr; Back to List</Link>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{wo.tender.title}</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">{wo.workOrderNo}</span>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                            wo.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 
                            wo.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>{wo.status}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Contract Value</div>
                    <div className="text-3xl font-black text-slate-900">₹{wo.totalValue.toLocaleString('en-IN')}</div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Vendor Details</h2>
                            <div className="font-bold text-slate-800">{wo.vendor.name}</div>
                            <div className="text-sm text-slate-600">{wo.vendor.vendorCode}</div>
                            <div className="text-sm text-slate-600 mt-1">{wo.vendor.email}</div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Assigned Inspector</h2>
                            <div className="font-bold text-slate-800">{wo.inspector?.name || 'Unassigned'}</div>
                            <div className="text-sm text-slate-600">{wo.inspector?.type}</div>
                        </div>
                    </div>

                    {/* Scope Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span>📝</span> Scope of Work
                        </h2>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">{wo.scopeDescription}</p>
                    </div>

                    {/* Terms Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Payment Terms</h2>
                            <p className="text-sm text-slate-600 leading-relaxed">{wo.paymentTerms}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Penalty / LD Terms</h2>
                            <p className="text-sm text-slate-600 leading-relaxed">{wo.liquidatedDamagesTerms}</p>
                        </div>
                    </div>

                    {/* Milestones Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span>📍</span> Project Milestones
                        </h2>
                        <div className="space-y-4">
                            {wo.milestones.map((m, idx) => (
                                <div key={m.id} className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800">{m.title}</div>
                                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Target: {new Date(m.targetDate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-slate-900">{m.weightage}%</div>
                                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Weight</div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <div className="text-sm font-black text-blue-700">{m.paymentPercentage}%</div>
                                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Payout</div>
                                    </div>
                                    {m.status === 'Inspection Requested' && (
                                        <button
                                            onClick={() => handleApproveMilestone(m.id)}
                                            className="bg-emerald-700 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-4 shadow-sm"
                                        >
                                            Approve Milestone
                                        </button>
                                    )}
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ml-4 ${
                                        m.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                                        m.status === 'Inspection Requested' ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-slate-200 text-slate-600'
                                    }`}>{m.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Inspection & Progress Reports Section */}
                    {reports.length > 0 && (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <span>📋</span> Inspection & Progress Reports
                            </h2>
                            <div className="space-y-6">
                                {reports.map((r) => (
                                    <div key={r.id} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Reported On</div>
                                                <div className="font-bold text-slate-800">{new Date(r.reportedAt).toLocaleString('en-IN')}</div>
                                                {r.milestone && (
                                                    <div className="text-sm font-semibold text-blue-700 mt-1">Milestone: {r.milestone.title}</div>
                                                )}
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                                                r.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-700' : 
                                                r.status === 'Returned' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}>{r.status}</span>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1">Work Description</div>
                                            <p className="text-sm text-slate-700 bg-white p-3 border border-slate-100 rounded-xl">{r.workDescription}</p>
                                        </div>

                                        {r.remarks && (
                                            <div className="mb-4">
                                                <div className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-1">Inspector Remarks</div>
                                                <p className="text-sm text-orange-800 bg-orange-50 p-3 border border-orange-100 rounded-xl">{r.remarks}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-sm font-bold mt-4">
                                            <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                                                <span className="text-xl">📈</span>
                                                <div>
                                                    <div className="text-[10px] text-slate-600 uppercase tracking-widest">Physical Progress</div>
                                                    <div className="text-slate-800">{r.physicalPercentage}%</div>
                                                </div>
                                            </div>
                                            {r.mediaUrls && r.mediaUrls.length > 0 && (
                                                <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                                                    <span className="text-xl">📷</span>
                                                    <div>
                                                        <div className="text-[10px] text-slate-600 uppercase tracking-widest">Evidence</div>
                                                        <div className="text-blue-700">
                                                            {r.mediaUrls.map((url: string, i: number) => (
                                                                <a key={i} href={formatMediaUrl(url)} target="_blank" rel="noreferrer" className="hover:underline mr-2">Photo {i + 1}</a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    {/* Execution Timeline */}
                    <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
                        <h2 className="text-slate-600 text-xs font-black uppercase tracking-widest mb-4">Execution Timeline</h2>
                        <div className="space-y-6">
                            <div>
                                <div className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1">Start Date</div>
                                <div className="text-lg font-bold">{new Date(wo.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                            <div>
                                <div className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1">Completion Deadline</div>
                                <div className="text-lg font-bold text-blue-400">{new Date(wo.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                        </div>
                    </div>

                    {/* Document Section */}
                    {wo.agreementDocumentUrl && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Contract Document</h2>
                            <a 
                                href={formatMediaUrl(wo.agreementDocumentUrl)} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-3 p-3 bg-blue-50 rounded-2xl text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                                <span className="text-2xl">📄</span>
                                <div className="flex-1 overflow-hidden">
                                    <div className="font-bold text-sm truncate">View Signed Agreement</div>
                                    <div className="text-[10px] font-medium opacity-70 uppercase">PDF / Digital Document</div>
                                </div>
                            </a>
                        </div>
                    )}

                    {/* Administrative Actions — cancellation is only permitted before the
                        vendor accepts the work order (matches the backend transition rules). */}
                    {['Draft', 'Authority Approval', 'Pending Vendor Acceptance'].includes(wo.status) && (user?.role === 'Admin' || user?.role === 'PMU') && (
                        <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm">
                            <h2 className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">Danger Zone</h2>
                            <button
                                onClick={() => askConfirm({
                                    open: true,
                                    title: 'Cancel This Work Order?',
                                    message: `Are you sure you want to cancel ${wo.workOrderNo}? This will terminate the contract process and notify the vendor. This action is recorded in audit logs.`,
                                    label: 'Yes, Terminate Order',
                                    variant: 'danger',
                                    onConfirm: handleCancel
                                })}
                                disabled={acting}
                                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 py-3 rounded-2xl font-bold text-sm hover:bg-red-600 hover:text-white transition-all disabled:"
                            >
                                <AlertCircle className="w-4 h-4" />
                                <span>{acting ? 'Cancelling...' : 'Cancel Work Order'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
