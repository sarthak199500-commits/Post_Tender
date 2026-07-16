import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';

interface BillItem {
    id: string;
    billNo: string;
    workOrderNo: string;
    vendorName: string;
    amount: number;
    taxAmount: number;
    totalAmount: number;
    submittedAt: string;
    status: string;
    paymentVoucherNo: string | null;
}

export const AdminBilling = () => {
    const { token } = useSelector((state: RootState) => state.auth);
    const [bills, setBills] = useState<BillItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [filter, setFilter] = useState('All');

    // /api/bills returns raw Bill rows, which carry workOrderId but neither the work
    // order number nor the vendor name — those live in TenderService and VendorService.
    // Resolve them client-side via workOrderId -> WorkOrder -> vendorId -> Vendor, the
    // same join dashboardService.ts already performs.
    const fetchBills = async () => {
        try {
            setLoading(true);
            const [billsRes, workOrdersRes, vendorsRes] = await Promise.all([
                axiosInstance.get('/bills'),
                axiosInstance.get('/workorders').catch(() => ({ data: [] })),
                axiosInstance.get('/vendors').catch(() => ({ data: [] })),
            ]);

            const workOrders: any[] = workOrdersRes.data ?? [];
            const vendors: any[] = vendorsRes.data ?? [];

            setBills((billsRes.data ?? []).map((bill: any): BillItem => {
                const workOrder = workOrders.find(w => w.id === bill.workOrderId);
                const vendor = vendors.find(v => v.id === workOrder?.vendorId);
                return {
                    ...bill,
                    workOrderNo: workOrder?.workOrderNo ?? '—',
                    vendorName: vendor?.name ?? '—',
                };
            }));
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? 'Failed to fetch bills');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBills();
    }, [token]);

    const handleApprove = async (id: string) => {
        if (!window.confirm('Are you sure you want to approve this bill and forward it to Finance?')) return;
        setActionLoading(id);
        try {
            await axiosInstance.post(`/bills/${id}/approve`);
            fetchBills();
        } catch (err) {
            alert('Action failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = window.prompt('Enter reason for returning the bill:');
        if (!reason) return;
        setActionLoading(id);
        try {
            await axiosInstance.post(`/bills/${id}/reject`, { reason });
            fetchBills();
        } catch (err) {
            alert('Action failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const badgeClass = (status: string) => {
        const map: Record<string, string> = {
            'Submitted': 'bg-blue-100 text-blue-700',
            'Under Review': 'bg-purple-100 text-purple-700',
            'Approved': 'bg-emerald-100 text-emerald-700',
            'Paid': 'bg-emerald-100 text-emerald-700',
            'Returned': 'bg-red-100 text-red-700'
        };
        return map[status] || 'bg-slate-100 text-slate-700';
    };

    const filteredBills = filter === 'All' ? bills : bills.filter(b => b.status === filter);

    if (error) return (
        <div className="p-10 text-center">
            <div className="text-red-700 font-bold mb-4">{error}</div>
            <button onClick={fetchBills} className="bg-blue-700 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Retry</button>
        </div>
    );

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-10">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Billing & Payments</h1>
                <p className="text-slate-600 mt-2 font-medium">Review vendor bills and forward approved claims to Finance for payment release.</p>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800">Vendor Claims Pending Review</h2>
                    <div className="flex gap-2">
                        {['All', 'Submitted', 'Approved', 'Paid', 'Returned'].map(f => (
                            <button 
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                                    filter === f ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-600 font-bold">Loading billing data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-600 font-black">
                                    <th className="p-4 border-b border-slate-200">Bill No</th>
                                    <th className="p-4 border-b border-slate-200">Work Order</th>
                                    <th className="p-4 border-b border-slate-200">Vendor</th>
                                    <th className="p-4 border-b border-slate-200">Amount (₹)</th>
                                    <th className="p-4 border-b border-slate-200">Tax (₹)</th>
                                    <th className="p-4 border-b border-slate-200">Date</th>
                                    <th className="p-4 border-b border-slate-200">Status</th>
                                    <th className="p-4 border-b border-slate-200 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBills.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-600 font-medium">No bills found.</td>
                                    </tr>
                                ) : (
                                    filteredBills.map(b => (
                                        <tr key={b.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                            <td className="p-4 font-bold text-slate-800">{b.billNo}</td>
                                            <td className="p-4 text-sm text-slate-600 font-medium">{b.workOrderNo}</td>
                                            <td className="p-4 text-sm text-slate-600">{b.vendorName}</td>
                                            <td className="p-4 text-sm font-bold text-slate-900">₹{b.amount.toLocaleString('en-IN')}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">₹{b.taxAmount.toLocaleString('en-IN')}</td>
                                            <td className="p-4 text-sm text-slate-600">{new Date(b.submittedAt).toLocaleDateString('en-IN')}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeClass(b.status)}`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {(b.status === 'Submitted' || b.status === 'Under Review') && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleApprove(b.id)}
                                                                disabled={actionLoading !== null}
                                                                className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors disabled:"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button 
                                                                onClick={() => handleReject(b.id)}
                                                                disabled={actionLoading !== null}
                                                                className="px-3 py-1.5 bg-white text-red-700 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors disabled:"
                                                            >
                                                                Return
                                                            </button>
                                                        </>
                                                    )}
                                                    {b.status === 'Approved' && <span className="text-xs font-bold text-emerald-700">Sent to Finance</span>}
                                                    {b.status === 'Paid' && <span className="text-xs font-bold text-slate-600">Completed</span>}
                                                    {b.status === 'Returned' && <span className="text-xs font-bold text-red-700">Returned</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminBilling;
