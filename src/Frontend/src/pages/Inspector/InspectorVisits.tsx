import React, { useState, useEffect } from 'react';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';

interface Visit {
    id: string;
    workOrderId: string;
    workOrderNo: string;
    tenderTitle: string;
    scheduledDate: string;
    purpose: string;
    status: string;
    remarks?: string;
}

interface AssignedWorkOrder {
    id: string;
    workOrderNo: string;
    tenderTitle: string;
    vendorName: string;
}

const InspectorVisits: React.FC = () => {
    const { token, user } = useSelector((state: RootState) => state.auth);
    const location = useLocation();
    const navigate = useNavigate();

    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [workOrders, setWorkOrders] = useState<AssignedWorkOrder[]>([]);
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [purpose, setPurpose] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Read query params
    const queryParams = new URLSearchParams(location.search);
    const woIdParam = queryParams.get('woId');

    // InspectionVisit rows carry only a workOrderId, so we resolve the work order / tender
    // titles for display on the client from the assigned-work-orders list.
    const fetchVisits = async (woList?: AssignedWorkOrder[]) => {
        try {
            const list = woList ?? workOrders;
            const woById = new Map(list.map(w => [w.id, w]));
            const res = await axiosInstance.get<Visit[]>('/InspectionVisits');
            setVisits((res.data || []).map(v => ({
                ...v,
                workOrderNo: v.workOrderNo || woById.get(v.workOrderId)?.workOrderNo || '—',
                tenderTitle: v.tenderTitle || woById.get(v.workOrderId)?.tenderTitle || '—',
            })));
        } catch (err) {
            console.error('Failed to fetch visits', err);
        } finally {
            setLoading(false);
        }
    };

    // Work Orders are keyed by Inspector.Id (not User.Id) and tender names live in another
    // service, so resolve the inspector's own id and compose titles on the client.
    const fetchWorkOrders = async (): Promise<AssignedWorkOrder[]> => {
        try {
            const inspectorsRes = await axiosInstance.get<{ id: string; userId?: string }[]>('/inspectors');
            const me = (inspectorsRes.data || []).find(i => i.userId === user?.id);
            if (!me) { setWorkOrders([]); return []; }

            interface WoRow { id: string; workOrderNo: string; tenderId?: string; vendorId?: string; }
            const [woRes, tendersRes, vendorsRes] = await Promise.all([
                axiosInstance.get<WoRow[]>('/workorders', { params: { inspectorId: me.id } }),
                axiosInstance.get<{ id: string; title?: string }[]>('/tenders').catch(() => ({ data: [] as { id: string; title?: string }[] })),
                axiosInstance.get<{ id: string; name?: string }[]>('/vendors').catch(() => ({ data: [] as { id: string; name?: string }[] })),
            ]);

            const tenderById = new Map((tendersRes.data || []).map(t => [t.id, t]));
            const vendorById = new Map((vendorsRes.data || []).map(v => [v.id, v]));
            const composed: AssignedWorkOrder[] = (woRes.data || []).map(w => ({
                ...w,
                tenderTitle: (w.tenderId && tenderById.get(w.tenderId)?.title) || '—',
                vendorName: (w.vendorId && vendorById.get(w.vendorId)?.name) || '—',
            }));
            setWorkOrders(composed);
            return composed;
        } catch (err) {
            console.error('Failed to fetch assigned work orders', err);
            return [];
        }
    };

    useEffect(() => {
        if (token) {
            (async () => {
                const wos = await fetchWorkOrders();
                await fetchVisits(wos);
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, user?.id]);

    // Handle incoming redirect with pre-selected work order
    useEffect(() => {
        if (woIdParam && workOrders.length > 0) {
            const exists = workOrders.some(w => w.id === woIdParam);
            if (exists) {
                setSelectedWorkOrderId(woIdParam);
                setIsModalOpen(true);
            }
            // Clear parameters to avoid reopening modal on refresh
            navigate('/inspector/visits', { replace: true });
        }
    }, [woIdParam, workOrders, navigate]);

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWorkOrderId || !scheduledDate || !purpose) {
            alert('Please fill out all fields.');
            return;
        }
        setSubmitting(true);
        try {
            await axiosInstance.post('/InspectionVisits', {
                workOrderId: selectedWorkOrderId,
                scheduledDate: new Date(scheduledDate).toISOString(),
                purpose: purpose
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setIsModalOpen(false);
            setSelectedWorkOrderId('');
            setScheduledDate('');
            setPurpose('');
            fetchVisits();
        } catch (err) {
            const detail = isAxiosError(err) && typeof err.response?.data === 'string' ? err.response.data : '';
            alert(detail || 'Failed to schedule visit');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCompleteVisit = async (visitId: string) => {
        const remarks = window.prompt('Enter inspection remarks/findings for this visit:');
        if (remarks === null) return;
        if (!remarks.trim()) {
            alert('Remarks are required to complete a visit.');
            return;
        }
        try {
            await axiosInstance.put(`/InspectionVisits/${visitId}/status`, {
                status: 'Completed',
                remarks: remarks
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchVisits();
        } catch {
            alert('Failed to update visit status');
        }
    };

    const handleCancelVisit = async (visitId: string) => {
        if (!window.confirm('Are you sure you want to cancel this visit?')) return;
        try {
            await axiosInstance.put(`/InspectionVisits/${visitId}/status`, {
                status: 'Cancelled',
                remarks: 'Visit cancelled by inspector.'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchVisits();
        } catch {
            alert('Failed to cancel visit');
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-600">Loading scheduled visits...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Audit & Site Visits</h1>
                    <p className="text-slate-600 mt-2 font-medium">Schedule and track your site inspections.</p>
                </div>
                <button 
                    onClick={() => { setSelectedWorkOrderId(''); setIsModalOpen(true); }}
                    className="bg-blue-700 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                    + Schedule New Visit
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visits.map((v) => (
                    <div key={v.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                    v.status === 'Scheduled' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                    v.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                    'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                    {v.status}
                                </span>
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-1 line-clamp-2" title={v.tenderTitle}>{v.tenderTitle}</h2>
                            <div className="text-xs text-slate-600 mb-4 font-bold">{v.workOrderNo}</div>
                            
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span className="text-lg">🗓️</span>
                                    <span className="font-semibold">{new Date(v.scheduledDate).toLocaleDateString()}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="font-semibold">{new Date(v.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex items-start gap-2 text-sm text-slate-600 font-medium">
                                    <span className="text-lg leading-none">🎯</span>
                                    <span>{v.purpose}</span>
                                </div>
                                {v.remarks && (
                                    <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 italic">
                                        <strong>Findings:</strong> {v.remarks}
                                    </div>
                                )}
                            </div>
                        </div>

                        {v.status === 'Scheduled' && (
                            <div className="flex gap-2 border-t border-slate-50 pt-4 mt-auto">
                                <button 
                                    onClick={() => handleCompleteVisit(v.id)}
                                    className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                                >
                                    ✓ Complete Visit
                                </button>
                                <button 
                                    onClick={() => handleCancelVisit(v.id)}
                                    className="flex-1 bg-white text-red-700 border border-red-200 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors text-center"
                                >
                                    Cancel Visit
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {visits.length === 0 && (
                    <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-slate-200 text-center col-span-full">
                        <div className="text-4xl mb-4">📋</div>
                        <h2 className="text-xl font-bold text-slate-700">No Scheduled Visits</h2>
                        <p className="text-slate-600 mt-2">Plan your site inspections by scheduling visits.</p>
                    </div>
                )}
            </div>

            {/* ─── Schedule Visit Modal ─── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Schedule Inspection Visit</h2>
                                <p className="text-xs text-slate-600 mt-0.5">Define inspection date, time and objective</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-600 hover:text-slate-600 bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center border border-slate-100"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleScheduleSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Select Work Order / Project</label>
                                    <select aria-label="Select an option"
                                        value={selectedWorkOrderId}
                                        onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                                        required
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-slate-800"
                                    >
                                        <option value="">-- Choose Assigned Project --</option>
                                        {workOrders.map((wo) => (
                                            <option key={wo.id} value={wo.id}>
                                                {wo.workOrderNo} - {wo.tenderTitle}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Scheduled Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        required
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">Purpose of Visit</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Foundation Quality Check, Milestone 2 Audit"
                                        value={purpose}
                                        onChange={(e) => setPurpose(e.target.value)}
                                        required
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-700 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all disabled:"
                                >
                                    {submitting ? 'Scheduling...' : 'Schedule Visit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InspectorVisits;
