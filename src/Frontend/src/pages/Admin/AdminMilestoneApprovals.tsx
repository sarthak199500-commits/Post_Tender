import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { CheckCircle, AlertTriangle, MessageSquare, AlertCircle, Eye, CornerDownLeft, Clock } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { rupees, rupeesCompact } from '../../utils/currency';

interface Report {
    id: string;
    physicalPercentage: number;
    workDescription: string;
    remarks?: string;
    mediaUrls: string[];
    status: string;
    reportedAt: string;
}

interface PendingMilestone {
    id: string;
    title: string;
    weightage: number;
    paymentPercentage: number;
    targetDate: string;
    status: string;
    projectName: string;
    workOrderNo: string;
    vendorName: string;
    reports: Report[];
}

export const AdminMilestoneApprovals = () => {
    const [milestones, setMilestones] = useState<PendingMilestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const { token } = useSelector((state: RootState) => state.auth);

    // Confirm dialog state
    const [confirm, setConfirm] = useState<{
        open: boolean;
        title: string;
        message: string;
        label: string;
        variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
        requireInput?: boolean;
    }>({ open: false, title: '', message: '', label: '', variant: 'warning', onConfirm: () => { } });

    const askConfirm = (cfg: typeof confirm) => setConfirm({ ...cfg, open: true });
    const closeConfirm = () => setConfirm(c => ({ ...c, open: false }));

    const fetchPendingMilestones = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:5249/api/projects/milestones/pending', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setMilestones(data);
        } catch (err) {
            console.error('Failed to fetch pending milestones', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingMilestones();
    }, [token]);

    const handleApprove = async (id: string) => {
        setActing(id);
        try {
            const res = await fetch(`http://localhost:5249/api/projects/milestone/${id}/approve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                fetchPendingMilestones();
            } else {
                alert('Failed to approve milestone.');
            }
        } catch (err) {
            console.error(err);
            alert('Error approving milestone.');
        } finally {
            setActing(null);
        }
    };

    const handleReturn = async (id: string, reason: string) => {
        setActing(id);
        try {
            const res = await fetch(`http://localhost:5249/api/projects/milestone/${id}/return`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                fetchPendingMilestones();
            } else {
                alert('Failed to return milestone.');
            }
        } catch (err) {
            console.error(err);
            alert('Error returning milestone.');
        } finally {
            setActing(null);
        }
    };

    const formatMediaUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `http://localhost:5249${url}`;
    };

    if (loading) return <div className="p-10 text-center text-slate-600">Loading pending milestones...</div>;

    return (
        <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
            <ConfirmDialog
                isOpen={confirm.open}
                title={confirm.title}
                message={confirm.message}
                confirmLabel={confirm.label}
                variant={confirm.variant}
                requireInput={confirm.requireInput}
                onConfirm={(inputValue) => { 
                    closeConfirm(); 
                    if (confirm.requireInput && !inputValue) {
                        alert("Reason is required.");
                        return;
                    }
                    (confirm.onConfirm as any)(inputValue); 
                }}
                onCancel={closeConfirm}
            />

            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-indigo-600" />
                    Milestone Approvals
                </h1>
                <p className="text-slate-600 mt-2">
                    Review and approve project milestones submitted by vendors and verified by inspectors.
                </p>
            </div>

            {milestones.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
                    <CheckCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-600 text-lg font-medium">No pending milestones require your approval.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {milestones.map((m) => (
                        <div key={m.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{m.projectName}</h2>
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-600 bg-slate-200 px-2 py-1 rounded">
                                            {m.workOrderNo}
                                        </span>
                                        <span className="text-sm font-medium text-slate-600">
                                            Vendor: <span className="font-bold text-slate-800">{m.vendorName}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-left md:text-right">
                                    <div className="text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl inline-block border border-indigo-100">
                                        {m.title} ({m.weightage}%)
                                    </div>
                                    <div className="text-xs text-slate-600 mt-2 font-medium">
                                        Target: {new Date(m.targetDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-2">
                                    <Eye className="w-4 h-4" /> Inspector Reports & Evidence
                                </h2>
                                
                                {m.reports.length === 0 ? (
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-800 flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <span className="font-bold">No Inspection Report Found.</span> 
                                            {" "} The vendor has submitted this milestone, but an inspector has not yet submitted a progress report.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {m.reports.map((r) => (
                                            <div key={r.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-slate-600" />
                                                        <span className="text-xs font-bold text-slate-600">
                                                            {new Date(r.reportedAt).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded ${
                                                        r.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {r.status}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Work Description</div>
                                                        <p className="text-sm text-slate-700">{r.workDescription}</p>
                                                    </div>
                                                    
                                                    {r.remarks && (
                                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">Inspector Remarks</div>
                                                            <p className="text-sm text-orange-800">{r.remarks}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-4">
                                                    <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 text-sm font-bold">
                                                        <span>Physical Progress:</span>
                                                        <span className="text-lg">{r.physicalPercentage}%</span>
                                                    </div>
                                                    
                                                    {r.mediaUrls && r.mediaUrls.length > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Evidence:</span>
                                                            <div className="flex gap-2">
                                                                {r.mediaUrls.map((url: string, i: number) => (
                                                                    <a key={i} href={formatMediaUrl(url)} target="_blank" rel="noreferrer" 
                                                                       className="text-xs font-bold bg-white border border-slate-200 text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                                                                        Photo {i + 1}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
                                <button
                                    onClick={() => askConfirm({
                                        open: true,
                                        title: 'Ask for Changes',
                                        message: `Please provide a reason for returning milestone "${m.title}" to the vendor.`,
                                        label: 'Return Milestone',
                                        variant: 'danger',
                                        requireInput: true,
                                        onConfirm: ((reason: string) => handleReturn(m.id, reason)) as any
                                    })}
                                    disabled={acting === m.id}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:"
                                >
                                    <CornerDownLeft className="w-4 h-4" />
                                    <span>Ask for Changes</span>
                                </button>
                                
                                <button
                                    onClick={() => askConfirm({
                                        open: true,
                                        title: 'Approve Milestone',
                                        message: `Are you sure you want to approve "${m.title}"? This will allow the vendor to raise a bill for ${m.paymentPercentage}% of the contract value.`,
                                        label: 'Approve Milestone',
                                        variant: 'info',
                                        onConfirm: () => handleApprove(m.id)
                                    })}
                                    disabled={acting === m.id || (m.reports.length === 0 && m.status !== 'Submitted')}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors disabled:"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>{acting === m.id ? 'Approving...' : 'Approve Milestone'}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
