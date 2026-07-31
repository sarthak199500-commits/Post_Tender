import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { X, Upload, FileText, CheckCircle, AlertCircle, Landmark } from 'lucide-react';
import type { RootState } from '../../store';
import { rupeesCompact } from '../../utils/currency';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import type { WorkOrder, Milestone, Bill, BillingPolicy } from '../../types/domain';

interface SubmitBillModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// A bill in one of these states still holds its milestone claim and its share of an
// outstanding advance. Mirrors BillsController's ClaimingStatuses — this client-side
// preview is informational only, the server is what actually enforces it.
const CLAIMING_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Paid'];

export const SubmitBillModal: React.FC<SubmitBillModalProps> = ({ onClose, onSuccess }) => {
  const { token } = useSelector((state: RootState) => state.auth);

  // "claim" is the existing RA/Final flow billed against completed milestones. "advance"
  // is a one-time mobilisation payment raised before any milestone work — it needs
  // different fields (an amount instead of a milestone selection) and a different cap,
  // so it is a separate mode rather than a checkbox bolted onto the claim form.
  const [mode, setMode] = useState<'claim' | 'advance'>('claim');

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWO, setSelectedWO] = useState<string>('');
  const [woDetails, setWoDetails] = useState<WorkOrder | null>(null);
  // Milestones are owned by ExecutionService, not returned by /workorders/{id}, so they are
  // fetched separately. Only "Completed" milestones (approved by the department) are billable.
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);

  const [advanceAmount, setAdvanceAmount] = useState('');

  const [myBills, setMyBills] = useState<Bill[]>([]);
  const [policy, setPolicy] = useState<BillingPolicy | null>(null);

  const [file, setFile] = useState<File | null>(null);

  // The bill number is the vendor's own invoice reference and is what payment vouchers are
  // reconciled against, so they type it. It used to be generated as
  // `BILL-<year>-<random 0..9999>`, which the vendor never saw and which could collide with
  // one of their own earlier bills — the server enforces uniqueness per vendor, so a
  // collision surfaced as a confusing rejection. The suggested default is time-based.
  const [billNo, setBillNo] = useState(
    () => `BILL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
  );

  // Tax rates come from the master (Admin > Tax Configuration). 18% is the fallback when
  // nothing is configured — it is what this modal used to hardcode unconditionally.
  const [taxRate, setTaxRate] = useState(18);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const taxOn = (amount: number) => amount * (taxRate / 100);

  // Fetch Work Orders
  useEffect(() => {
    axiosInstance.get('/workorders')
      .then(res => setWorkOrders((res.data ?? []).filter((w: WorkOrder) => w.status === 'Accepted')))
      .catch(() => setError('Failed to load work orders'));
  }, [token]);

  // Active tax rates compound onto the claim (e.g. CGST 9 + SGST 9). An unreachable or
  // empty master leaves the 18% fallback in place rather than billing zero tax.
  useEffect(() => {
    axiosInstance.get<{ percentage?: number; isActive?: boolean }[]>('/masters/taxconfigurations')
      .then(res => {
        const total = (res.data ?? [])
          .filter(t => t.isActive !== false)
          .reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);
        if (total > 0) setTaxRate(total);
      })
      .catch(() => { /* master unavailable — keep the fallback */ });
  }, [token]);

  // Retention % and the advance cap come from the org policy; this vendor's own bills are
  // what let us preview retention/recovery per work order without a dedicated endpoint —
  // GET /bills already scopes to the caller's own bills.
  useEffect(() => {
    axiosInstance.get<BillingPolicy>('/masters/billingpolicy')
      .then(res => setPolicy(res.data))
      .catch(() => { /* policy unavailable — previews just won't show */ });
    axiosInstance.get<Bill[]>('/bills')
      .then(res => setMyBills(res.data ?? []))
      .catch(() => { /* previews just won't show */ });
  }, [token]);

  // Fetch WO Details + milestones when selected
  useEffect(() => {
    if (!selectedWO) {
      setWoDetails(null);
      setMilestones([]);
      setSelectedMilestones([]);
      return;
    }
    setLoading(true);
    Promise.all([
      axiosInstance.get(`/workorders/${selectedWO}`),
      axiosInstance.get('/execution/milestones', { params: { workOrderId: selectedWO } }),
    ])
      .then(([woRes, msRes]) => {
        setWoDetails(woRes.data);
        setMilestones(msRes.data ?? []);
        setSelectedMilestones([]);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load work order details');
        setLoading(false);
      });
  }, [selectedWO, token]);

  const toggleMilestone = (id: string) => {
    setSelectedMilestones(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const calculateAmount = () => {
    if (!woDetails) return 0;
    const totalValue = woDetails.totalValue;
    const percentage = milestones
      .filter(m => selectedMilestones.includes(m.id))
      .reduce((acc, m) => acc + m.paymentPercentage, 0);
    return totalValue * (percentage / 100);
  };

  // Preview only — the server recomputes and enforces this independently at Create.
  const outstandingAdvance = (() => {
    if (!selectedWO) return 0;
    const paid = myBills
      .filter(b => b.workOrderId === selectedWO && b.type === 'Advance' && b.status === 'Paid')
      .reduce((sum, b) => sum + b.amount, 0);
    const recovered = myBills
      .filter(b => b.workOrderId === selectedWO && b.type !== 'Advance' && CLAIMING_STATUSES.includes(b.status))
      .reduce((sum, b) => sum + (b.advanceRecovered || 0), 0);
    return Math.max(0, paid - recovered);
  })();

  const hasPendingAdvance = selectedWO
    ? myBills.some(b => b.workOrderId === selectedWO && b.type === 'Advance'
        && ['Submitted', 'Under Review', 'Approved'].includes(b.status))
    : false;

  const claimAmount = calculateAmount();
  const retentionPreview = policy ? Math.round(claimAmount * (policy.retentionPercentage / 100) * 100) / 100 : 0;
  const advanceRecoveryPreview = policy && outstandingAdvance > 0
    ? Math.min(Math.round(claimAmount * (policy.advanceRecoveryPercentage / 100) * 100) / 100, outstandingAdvance)
    : 0;
  const netPayablePreview = claimAmount + taxOn(claimAmount) - retentionPreview - advanceRecoveryPreview;

  const advanceCap = policy && woDetails ? woDetails.totalValue * (policy.maxAdvancePercentage / 100) : 0;
  const advanceAmountNum = Number(advanceAmount) || 0;

  const uploadAttachment = async (): Promise<string> => {
    if (!file) return '';
    const form = new FormData();
    form.append('file', file);
    const { data } = await axiosInstance.post('/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.url;
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWO || selectedMilestones.length === 0) {
      setError('Please select a work order and at least one completed milestone.');
      return;
    }
    if (!billNo.trim()) {
      setError('Please enter your invoice number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // The file was never actually uploaded — the URL was fabricated from its name, so
      // every attachment on every bill resolved to nothing. Upload it for real and use the
      // URL the server hands back, the same way the rectification evidence flow does.
      const attachmentUrl = await uploadAttachment();

      await axiosInstance.post('/bills', {
        workOrderId: selectedWO,
        billNo: billNo.trim(),
        type: 'RA',
        amount: claimAmount,
        taxAmount: taxOn(claimAmount),
        attachmentUrl,
        milestoneIds: selectedMilestones,
      });
      onSuccess();
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data
        ? err.response.data : 'Failed to submit bill');
      setLoading(false);
    }
  };

  const handleSubmitAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWO || advanceAmountNum <= 0) {
      setError('Please select a work order and enter the advance amount you are requesting.');
      return;
    }
    if (!billNo.trim()) {
      setError('Please enter your invoice/request reference number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const attachmentUrl = await uploadAttachment();

      await axiosInstance.post('/bills', {
        workOrderId: selectedWO,
        billNo: billNo.trim(),
        type: 'Advance',
        amount: advanceAmountNum,
        taxAmount: taxOn(advanceAmountNum),
        attachmentUrl,
        milestoneIds: [],
      });
      onSuccess();
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data
        ? err.response.data : 'Failed to submit advance request');
      setLoading(false);
    }
  };

  const canSubmitClaim = selectedMilestones.length > 0 && !loading;
  const canSubmitAdvance = advanceAmountNum > 0 && !hasPendingAdvance && outstandingAdvance === 0 && !loading;

  return (
    <div className="fixed inset-0 !mt-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-card w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800">Raise New Claim</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-card">
            <button
              type="button"
              onClick={() => { setMode('claim'); setError(''); }}
              className={`flex-1 py-2 rounded-control text-sm font-bold transition-colors ${
                mode === 'claim' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Progress Claim
            </button>
            <button
              type="button"
              onClick={() => { setMode('advance'); setError(''); }}
              className={`flex-1 py-2 rounded-control text-sm font-bold transition-colors ${
                mode === 'advance' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Mobilisation Advance
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-card flex gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form id="billForm" onSubmit={mode === 'claim' ? handleSubmitClaim : handleSubmitAdvance} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Work Order</label>
              <select aria-label="Select an option"
                value={selectedWO}
                onChange={e => setSelectedWO(e.target.value)}
                className="w-full border border-slate-200 rounded-card p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-slate-50 font-medium"
              >
                <option value="">-- Select Work Order --</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.workOrderNo}</option>
                ))}
              </select>
            </div>

            {mode === 'claim' ? (
              <>
                {woDetails && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Select Completed Milestones</label>
                    <div className="space-y-3">
                      {milestones.filter(m => m.status === 'Completed').map(m => (
                        <label key={m.id} className="flex items-start gap-3 p-4 border border-slate-200 rounded-card hover:border-brand-300 hover:bg-brand-50/30 cursor-pointer transition-colors group">
                          <div className="mt-0.5">
                            <input
                              type="checkbox"
                              checked={selectedMilestones.includes(m.id)}
                              onChange={() => toggleMilestone(m.id)}
                              className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{m.title}</p>
                            <p className="text-xs text-slate-600 mt-1 font-medium flex gap-4">
                              <span>Weightage: {m.weightage}%</span>
                              <span>Payment: {m.paymentPercentage}%</span>
                            </p>
                          </div>
                        </label>
                      ))}
                      {milestones.filter(m => m.status === 'Completed').length === 0 && (
                        <div className="p-4 bg-slate-50 text-slate-600 rounded-card text-center text-sm border border-slate-100">
                          No completed milestones available to bill for this Work Order.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedMilestones.length > 0 && (
                  <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-card space-y-2">
                    <p className="text-emerald-800 font-bold">Calculated Claim Amount</p>
                    <div className="flex justify-between items-end">
                      <p className="text-3xl font-black text-emerald-700">{rupeesCompact(claimAmount)}</p>
                      <p className="text-sm font-medium text-emerald-700/80 mb-1">+ {taxRate}% tax</p>
                    </div>
                    <div className="pt-2 border-t border-emerald-100 space-y-1 text-xs text-emerald-800/90">
                      {policy && policy.retentionPercentage > 0 && (
                        <div className="flex justify-between">
                          <span>Retention withheld ({policy.retentionPercentage}%)</span>
                          <span className="font-bold">- {rupeesCompact(retentionPreview)}</span>
                        </div>
                      )}
                      {advanceRecoveryPreview > 0 && (
                        <div className="flex justify-between">
                          <span>Advance recovery ({policy?.advanceRecoveryPercentage}% toward outstanding advance)</span>
                          <span className="font-bold">- {rupeesCompact(advanceRecoveryPreview)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-emerald-900 pt-1">
                        <span>Estimated net payable</span>
                        <span>{rupeesCompact(netPayablePreview)}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-700/70">
                      Final figures — including any liquidated-damages deduction — are confirmed by the department on review.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {woDetails && policy && (
                  <div className="p-4 bg-brand-50 border border-brand-100 rounded-card flex items-start gap-3">
                    <Landmark className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-brand-900">
                      <p className="font-bold">Mobilisation advance eligibility</p>
                      <p className="mt-1">
                        Up to {policy.maxAdvancePercentage}% of the contract value ({rupeesCompact(woDetails.totalValue)}) —
                        a maximum of <span className="font-bold">{rupeesCompact(advanceCap)}</span>.
                      </p>
                    </div>
                  </div>
                )}

                {selectedWO && (hasPendingAdvance || outstandingAdvance > 0) && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-800 font-medium">
                    {hasPendingAdvance
                      ? 'An advance request is already pending on this work order.'
                      : `An advance of ${rupeesCompact(outstandingAdvance)} is still outstanding on this work order and must be recovered before another can be requested.`}
                  </div>
                )}

                {selectedWO && !hasPendingAdvance && outstandingAdvance === 0 && (
                  <div>
                    <label htmlFor="advanceAmount" className="block text-sm font-bold text-slate-700 mb-2">Advance Amount Requested</label>
                    <input
                      id="advanceAmount"
                      type="number"
                      min={0}
                      max={advanceCap || undefined}
                      value={advanceAmount}
                      onChange={e => setAdvanceAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                    />
                    {advanceCap > 0 && advanceAmountNum > advanceCap && (
                      <p className="text-xs text-red-700 mt-1 font-medium">Exceeds the {rupeesCompact(advanceCap)} cap for this work order.</p>
                    )}
                    {advanceAmountNum > 0 && (
                      <p className="text-xs text-slate-600 mt-2">
                        + {taxRate}% tax = total request {rupeesCompact(advanceAmountNum + taxOn(advanceAmountNum))}.
                        Recovered at {policy?.advanceRecoveryPercentage ?? 10}% of each progress claim until repaid.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div>
              <label htmlFor="billNo" className="block text-sm font-bold text-slate-700 mb-2">
                {mode === 'claim' ? 'Invoice Number' : 'Request Reference Number'}
              </label>
              <input
                id="billNo"
                type="text"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                placeholder="Your reference"
                className="w-full p-3 border border-slate-200 rounded-card focus:ring-2 focus:ring-brand-500 outline-none font-medium"
              />
              <p className="text-xs text-slate-600 mt-1">Must be unique across your bills — payment vouchers are reconciled against it.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {mode === 'claim' ? 'Invoice Document (PDF)' : 'Supporting Document (PDF)'}
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-card p-6 text-center hover:bg-slate-50 hover:border-brand-300 transition-colors cursor-pointer">
                <input type="file" id="invoiceFile" className="hidden" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                <label htmlFor="invoiceFile" className="cursor-pointer">
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-brand-500" />
                      <p className="font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-600">Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-slate-700">Click to upload{mode === 'advance' ? ' (e.g. bank guarantee)' : ' invoice'}</p>
                      <p className="text-xs text-slate-600">PDF up to 10MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </form>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-card font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="billForm"
            disabled={mode === 'claim' ? !canSubmitClaim : !canSubmitAdvance}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-card font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-100"
          >
            {loading ? 'Submitting...' : <><CheckCircle className="w-4 h-4" /> {mode === 'claim' ? 'Submit Claim' : 'Request Advance'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};
