import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { selectVendorId } from '../../api/currentVendor';
import { isAxiosError } from 'axios';
import axiosInstance, { GATEWAY_BASE } from '../../api/axiosInstance';
import type { WorkOrder, Milestone } from '../../types/domain';

export const VendorWorkOrderView = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const { token } = useSelector((state: RootState) => state.auth);
  const vendorId = useSelector(selectVendorId);

  useEffect(() => {
    fetchWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, vendorId]);

  // Work Orders are keyed by Vendor.Id. That now comes from the vendorId claim, so this
  // no longer downloads every vendor to find itself — the old approach depended on a
  // cross-tenant read that the backend is closing.
  async function fetchWorkOrders() {
    if (!vendorId) { setWorkOrders([]); return; }
    try {
      const [woRes, msRes] = await Promise.all([
        axiosInstance.get('/workorders', { params: { vendorId } }),
        axiosInstance.get('/execution/milestones').catch(() => ({ data: [] })),
      ]);

      const milestones: Milestone[] = msRes.data ?? [];
      setWorkOrders((woRes.data ?? []).map((w: WorkOrder) => ({
        ...w,
        milestones: milestones.filter(m => m.workOrderId === w.id),
      })));
    } catch (e) { console.error(e); }
  }

  const handleAccept = async (id: string) => {
    try {
      await axiosInstance.put(`/workorders/${id}/status`, { newStatus: 'Accepted' });
      fetchWorkOrders();
    } catch (e) {
      const detail = isAxiosError(e) && typeof e.response?.data === 'string' ? e.response.data : '';
      alert(detail || 'Failed to accept work order.');
      console.error(e);
    }
  };

  const pendingAccept = workOrders.find(w => w.id === acceptId);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <ConfirmDialog
        isOpen={acceptId !== null}
        title="Accept Work Order Agreement?"
        message={`You are digitally signing and accepting ${pendingAccept?.workOrderNo || 'this Work Order'}. Once accepted, the project will be activated and milestones will commence. This action cannot be reversed.`}
        confirmLabel="Accept Agreement"
        variant="info"
        onConfirm={() => { handleAccept(acceptId!); setAcceptId(null); }}
        onCancel={() => setAcceptId(null)}
      />

      <h1 className="text-3xl font-bold text-slate-800 mb-6">My Assigned Work Orders</h1>

      {workOrders.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-card border border-slate-200">
          <p className="text-slate-600">You currently have no assigned Work Orders.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {workOrders.map((wo) => (
            <div key={wo.id} className="bg-white p-6 rounded-card shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between md:items-center">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="text-xl font-bold text-slate-800">{wo.workOrderNo}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    wo.status === 'Accepted' || wo.status === 'Project Activated'
                    ? 'bg-emerald-100 text-emerald-700'
                    : wo.status === 'Draft'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {wo.status}
                  </span>
                </div>
                <p className="text-slate-600 max-w-2xl text-sm mb-4">{wo.scopeDescription}</p>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div><strong className="text-slate-700">Total Value:</strong> ₹{wo.totalValue?.toLocaleString('en-IN')}</div>
                  <div><strong className="text-slate-700">Milestones:</strong> {wo.milestones?.length || 0} stages</div>
                </div>
              </div>

              <div className="mt-4 md:mt-0 md:pl-6 md:border-l border-slate-100 flex flex-col gap-3 min-w-[200px]">
                {wo.agreementDocumentUrl ? (
                  <a
                    href={wo.agreementDocumentUrl.startsWith('http') ? wo.agreementDocumentUrl : `${GATEWAY_BASE}${wo.agreementDocumentUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full border border-brand-700 text-brand-700 hover:bg-brand-50 py-2 rounded-control font-medium transition-colors flex justify-center items-center"
                  >
                    View Agreement PDF
                  </a>
                ) : (
                  <button disabled title="No document attached" className="w-full border border-slate-300 text-slate-600 bg-slate-50 py-2 rounded-control font-medium cursor-not-allowed">
                    No PDF Available
                  </button>
                )}
                {wo.status !== 'Accepted' && wo.status !== 'Project Activated' && (
                  <button
                    onClick={() => setAcceptId(wo.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-control shadow transition-colors"
                  >
                    Accept Agreement
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
