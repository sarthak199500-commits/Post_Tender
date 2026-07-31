import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useNavigate, Link } from 'react-router-dom';
import { FilePlus, ChevronRight, CheckCircle, Clock, Send, AlertCircle, Info } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { rupeesCompact } from '../../utils/currency';
import axiosInstance from '../../api/axiosInstance';
import { statusChipClass } from '../../utils/statusTone';

interface VendorRecord { id: string; name: string; vendorCode?: string; }
interface MilestoneRecord { workOrderId: string; status: string; }
interface BillRecord { workOrderId: string; status: string; amount?: number; }
interface RawWorkOrder {
  id: string;
  workOrderNo: string;
  status: string;
  totalValue: number;
  startDate: string;
  endDate: string;
  vendorId: string;
}

interface WorkOrder {
  id: string;
  workOrderNo: string;
  status: string;
  totalValue: number;
  startDate: string;
  endDate: string;
  vendorName: string;
  vendorCode: string;
  milestoneCount: number;
  completedMilestones: number;
  totalPaidAmount?: number;
}

const STATUS_FLOW = ['Draft', 'Authority Approval', 'Pending Vendor Acceptance', 'Accepted', 'Completed'];

/* Status colours come from utils/statusTone so this page agrees with the rest of
   the app; `Accepted` in particular used to be `green` here and `emerald`
   everywhere else. */

export const WorkOrderManagement = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const { token, user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    label: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', label: '', variant: 'warning', onConfirm: () => {} });

  const askConfirm = (cfg: typeof confirm) => setConfirm({ ...cfg, open: true });
  const closeConfirm = () => setConfirm(c => ({ ...c, open: false }));

  // Work Orders live in TenderService but their vendor name, milestone progress and paid
  // amount live in other services, so we compose the enriched view on the client (this
  // codebase has no service-to-service calls / aggregation BFF).
  const loadWOs = async () => {
    try {
      const [woRes, vendorsRes, milestonesRes, billsRes] = await Promise.all([
        axiosInstance.get<RawWorkOrder[]>('/workorders'),
        axiosInstance.get<VendorRecord[]>('/vendors').catch(() => null),
        axiosInstance.get<MilestoneRecord[]>('/execution/milestones').catch(() => null),
        axiosInstance.get<BillRecord[]>('/bills').catch(() => null),
      ]);

      const wos = woRes.data;
      const vendors = vendorsRes?.data ?? [];
      const milestones = milestonesRes?.data ?? [];
      const bills = billsRes?.data ?? [];

      const vendorById = new Map(vendors.map(v => [v.id, v]));
      const paidByWO = new Map<string, number>();
      bills.filter(b => b.status === 'Paid').forEach(b => {
        paidByWO.set(b.workOrderId, (paidByWO.get(b.workOrderId) || 0) + (b.amount || 0));
      });

      const enriched: WorkOrder[] = wos.map(w => {
        const woMilestones = milestones.filter(m => m.workOrderId === w.id);
        return {
          ...w,
          vendorName: vendorById.get(w.vendorId)?.name || '—',
          vendorCode: vendorById.get(w.vendorId)?.vendorCode || '',
          milestoneCount: woMilestones.length,
          completedMilestones: woMilestones.filter(m => m.status === 'Completed').length,
          totalPaidAmount: paidByWO.get(w.id) || 0,
        };
      });

      setWorkOrders(enriched);
    } catch {
      // leave list empty on failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWOs(); }, [token]);

  const approve = async (id: string) => {
    setActing(id);
    try {
      await axiosInstance.put(`/workorders/${id}/approve`);
    } catch (e) { console.error(e); }
    setActing(null);
    loadWOs();
  };

  const transitionStatus = async (id: string, newStatus: string) => {
    setActing(id);
    try {
      await axiosInstance.put(`/workorders/${id}/status`, { newStatus });
    } catch (e) { console.error(e); }
    setActing(null);
    loadWOs();
  };

  if (loading) return <div className="text-slate-600">Loading work orders...</div>;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.label}
        variant={confirm.variant}
        onConfirm={() => { closeConfirm(); confirm.onConfirm(); }}
        onCancel={closeConfirm}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-slate-800">Work Orders</h1>
            <button 
              onClick={() => setShowWorkflow(!showWorkflow)}
              className="flex items-center justify-center p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
              title="Toggle Workflow Info"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-600 mt-1">Issue, track and approve work orders through the approval workflow.</p>
        </div>
        <button
          onClick={() => navigate('/admin/work-orders/new')}
          className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-control font-medium transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* Workflow Legend */}
      {showWorkflow && (
        <div className="bg-white border border-slate-200 rounded-card p-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <p className="text-xs font-semibold text-slate-600 uppercase mb-3">Approval Workflow</p>
          <div className="flex items-center space-x-2 overflow-x-auto">
            {STATUS_FLOW.map((s, i) => (
              <React.Fragment key={s}>
                <span className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${statusChipClass(s)}`}>{s}</span>
                {i < STATUS_FLOW.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {workOrders.map(wo => (
          <div key={wo.id} className="bg-white border border-slate-200 rounded-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-brand-50 rounded-control">
                  <FilePlus className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="font-semibold text-slate-800">{wo.workOrderNo}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusChipClass(wo.status)}`}>
                      {wo.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Vendor: <span className="font-medium text-slate-700">{wo.vendorName}</span>
                    <span className="mx-2">·</span>
                    Value: <span className="font-medium text-slate-700">{rupeesCompact(wo.totalValue)}</span>
                    <span className="mx-2">·</span>
                    Milestones: <span className="font-medium">{wo.completedMilestones}/{wo.milestoneCount} done</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {new Date(wo.startDate).toLocaleDateString()} → {new Date(wo.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <Link
                  to={`/admin/work-orders/${wo.id}`}
                  className="flex items-center space-x-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-control text-sm font-medium transition-colors"
                >
                  <span>View Details</span>
                </Link>
                {wo.status === 'Draft' && user?.role === 'Admin' && (
                  <button
                    onClick={() => askConfirm({
                      open: true,
                      title: 'Submit for Approval?',
                      message: `Work Order ${wo.workOrderNo} will be submitted for authority review. This moves it out of Draft status.`,
                      label: 'Submit',
                      variant: 'warning',
                      onConfirm: () => transitionStatus(wo.id, 'Authority Approval'),
                    })}
                    disabled={acting === wo.id}
                    className="flex items-center space-x-1 bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded-control text-sm font-medium transition-colors disabled:"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit for Approval</span>
                  </button>
                )}
                {wo.status === 'Authority Approval' && user?.role === 'Admin' && (
                  <button
                    onClick={() => askConfirm({
                      open: true,
                      title: 'Approve & Send to Vendor?',
                      message: `${wo.workOrderNo} will be officially issued to ${wo.vendorName}. The vendor will be notified to accept the work order. This cannot be undone.`,
                      label: 'Approve & Send',
                      variant: 'info',
                      onConfirm: () => approve(wo.id),
                    })}
                    disabled={acting === wo.id}
                    className="flex items-center space-x-1 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-control text-sm font-medium transition-colors disabled:"
                  >
                    <Send className="w-4 h-4" />
                    <span>{acting === wo.id ? 'Sending...' : 'Approve & Send to Vendor'}</span>
                  </button>
                )}
                {wo.status === 'Pending Vendor Acceptance' && (
                  <span className="flex items-center space-x-1 text-brand-700 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Awaiting vendor acceptance</span>
                  </span>
                )}
                {wo.status === 'Accepted' && user?.role === 'Admin' && (
                  <div className="flex items-center space-x-2">
                    {wo.completedMilestones === wo.milestoneCount && wo.totalPaidAmount === wo.totalValue ? (
                      <button
                        onClick={() => askConfirm({
                          open: true,
                          title: 'Mark as Completed?',
                          message: `${wo.workOrderNo} will be permanently closed. Ensure all milestones and payments have been verified before proceeding.`,
                          label: 'Mark Completed',
                          variant: 'danger',
                          onConfirm: () => transitionStatus(wo.id, 'Completed'),
                        })}
                        disabled={acting === wo.id}
                        className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-control text-sm font-medium transition-colors disabled:"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Mark Completed</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1 text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-control text-sm cursor-not-allowed group relative">
                        <AlertCircle className="w-4 h-4" />
                        <span>Cannot Close</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {wo.completedMilestones !== wo.milestoneCount ? 'All milestones must be completed.' : 'All bills must be paid in full.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {wo.milestoneCount > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Milestone Progress</span>
                  <span>{wo.completedMilestones} of {wo.milestoneCount} complete</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${wo.milestoneCount > 0 ? (wo.completedMilestones / wo.milestoneCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {workOrders.length === 0 && (
          <div className="bg-white rounded-card border border-slate-200 p-16 text-center">
            <FilePlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No work orders yet. Create one from an Awarded Tender.</p>
          </div>
        )}
      </div>
    </div>
  );
};
