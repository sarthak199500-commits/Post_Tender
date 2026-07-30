import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { fetchWorkOrderDetail } from '../../api/workOrderDetails';
import type { WorkOrderDetail } from '../../api/workOrderDetails';

const InspectorWorkOrderDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { token } = useSelector((state: RootState) => state.auth);
    const [wo, setWo] = useState<WorkOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const load = React.useCallback(async () => {
        if (!id) return;
        try {
            const detail = await fetchWorkOrderDetail(id);
            setWo(detail?.workOrder ?? null);
        } catch (err) {
            console.error('Failed to fetch WO details', err);
            setWo(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load, token]);

    if (loading) return <div className="p-10 text-center">Loading details...</div>;
    if (!wo) return <div className="p-10 text-center text-red-700 font-bold">Work Order not found.</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-10 flex justify-between items-start">
                <div>
                    <Link to="/inspector/work-orders" className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1">&larr; Back to List</Link>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{wo.tender.title}</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">{wo.workOrderNo}</span>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                            wo.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                        }`}>{wo.status}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Value</div>
                    <div className="text-3xl font-black text-slate-900">₹{wo.totalValue.toLocaleString('en-IN')}</div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Scope Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span>📝</span> Scope of Work
                        </h2>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">{wo.scopeDescription}</p>
                    </div>

                    {/* Milestones Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span>📍</span> Project Milestones
                        </h2>
                        <div className="space-y-4">
                            {wo.milestones.map((m, idx) => (
                                <div key={m.id} className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl relative">
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
                                    {m.status === 'Inspection Requested' && (
                                        // Approval itself is Admin/PMU/Department only
                                        // (ExecutionController.ApproveMilestone), so the inspector
                                        // reviews the submission and the decision happens there.
                                        <Link
                                            to={`/inspector/milestones/${m.id}/submission`}
                                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-4 shadow-sm inline-block"
                                        >
                                            View Submission
                                        </Link>
                                    )}
                                    {m.status === 'Completed' && (
                                        <Link
                                            to={`/inspector/milestones/${m.id}/submission`}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ml-4 shadow-sm inline-block"
                                        >
                                            View Submission
                                        </Link>
                                    )}
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ml-4 ${
                                        m.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                                        m.status === 'Inspection Requested' ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-slate-200 text-slate-600'
                                    }`}>{m.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Vendor Info */}
                    <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
                        <h2 className="text-slate-600 text-xs font-black uppercase tracking-widest mb-4">Vendor Details</h2>
                        <div className="text-xl font-bold mb-1">{wo.vendor.name}</div>
                        <div className="text-blue-400 text-xs font-bold mb-6">{wo.vendor.vendorCode}</div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-sm text-slate-600 font-medium">Start Date</span>
                                <span className="text-sm font-bold">{new Date(wo.startDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-sm text-slate-600 font-medium">End Date</span>
                                <span className="text-sm font-bold">{new Date(wo.endDate).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h2 className="font-bold text-slate-800 mb-4">Inspector Actions</h2>
                        <div className="space-y-3">
                            <Link to={`/inspector/visits/schedule?woId=${wo.id}`} className="block w-full bg-blue-700 text-white text-center py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                                Schedule Inspection
                            </Link>
                            {/* There is no /inspector/observations route — recording an
                                observation is what the Quality Defects page does. */}
                            <Link to="/inspector/defects" className="block w-full bg-white text-slate-700 border border-slate-200 text-center py-3 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                                Record Observation
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InspectorWorkOrderDetails;
