import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { Link } from 'react-router-dom';

interface WorkOrder {
    id: string;
    workOrderNo: string;
    tenderTitle: string;
    vendorName: string;
    totalValue: number;
    status: string;
    startDate: string;
    endDate: string;
}

const InspectorWorkOrders: React.FC = () => {
    const { token, user } = useSelector((state: RootState) => state.auth);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Work Orders are keyed by Inspector.Id, and tender/vendor names live in other
        // services, so resolve the inspector's own id and compose the view on the client.
        const fetchWorkOrders = async () => {
            try {
                const inspectorsRes = await axiosInstance.get('/inspectors');
                const me = (inspectorsRes.data || []).find((i: any) => i.userId === user?.id);
                if (!me) { setWorkOrders([]); return; }

                const [woRes, tendersRes, vendorsRes] = await Promise.all([
                    axiosInstance.get('/workorders', { params: { inspectorId: me.id } }),
                    axiosInstance.get('/tenders').catch(() => ({ data: [] })),
                    axiosInstance.get('/vendors').catch(() => ({ data: [] })),
                ]);

                const tenderById = new Map((tendersRes.data || []).map((t: any) => [t.id, t]));
                const vendorById = new Map((vendorsRes.data || []).map((v: any) => [v.id, v]));

                setWorkOrders((woRes.data || []).map((w: any) => ({
                    ...w,
                    tenderTitle: (tenderById.get(w.tenderId) as any)?.title || '—',
                    vendorName: (vendorById.get(w.vendorId) as any)?.name || '—',
                })));
            } catch (err) {
                console.error('Failed to fetch assigned work orders', err);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkOrders();
    }, [token, user?.id]);

    if (loading) return <div className="p-10 text-center text-slate-600">Loading your assignments...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-10">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Assigned Work Orders</h1>
                <p className="text-slate-600 mt-2 font-medium">Detailed view of projects currently under your oversight.</p>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {workOrders.map((wo) => (
                    <div key={wo.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:shadow-md transition-shadow">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded">{wo.workOrderNo}</span>
                                <span className="text-slate-600 text-xs">•</span>
                                <span className="text-slate-600 text-xs font-bold">{new Date(wo.startDate).toLocaleDateString()} to {new Date(wo.endDate).toLocaleDateString()}</span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-1">{wo.tenderTitle}</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span className="font-semibold">Vendor:</span>
                                <span className="text-blue-700 font-bold">{wo.vendorName}</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Project Value</div>
                                <div className="text-lg font-black text-slate-900">₹{wo.totalValue.toLocaleString('en-IN')}</div>
                            </div>
                            <div className="flex gap-2">
                                <Link to={`/inspector/work-orders/${wo.id}`} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                                    Full Details
                                </Link>
                                <Link to={`/inspector/visits/schedule?woId=${wo.id}`} className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
                                    Schedule Visit
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}

                {workOrders.length === 0 && (
                    <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                        <div className="text-4xl mb-4">📋</div>
                        <h2 className="text-xl font-bold text-slate-700">No Assigned Work Orders</h2>
                        <p className="text-slate-600 mt-2">You haven't been assigned to any active projects yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectorWorkOrders;
