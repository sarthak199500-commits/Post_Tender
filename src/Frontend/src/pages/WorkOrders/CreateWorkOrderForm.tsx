import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import axiosInstance from '../../api/axiosInstance';
import type { Inspector, Vendor, TenderAllotment } from '../../types/domain';

export const CreateWorkOrderForm = () => {
  const [step, setStep] = useState(1);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [allotments, setAllotments] = useState<TenderAllotment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const navigate = useNavigate();

  // Form State
  const [tenderId, setTenderId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [inspectorId, setInspectorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalValue, setTotalValue] = useState(0);
  const [scope, setScope] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [liquidatedDamagesTerms, setLiquidatedDamagesTerms] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removeIdx, setRemoveIdx] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState('');
  const [tenderBudget, setTenderBudget] = useState(0);
  const [costError, setCostError] = useState('');
  const [milestones, setMilestones] = useState([{ title: '', weightage: 0, paymentPercentage: 0, targetDate: '' }]);

  useEffect(() => {
    // Fetch Tender Allotments (Awarded Tenders with L1 Vendors)
    axiosInstance.get('/tenderallotments')
      .then(({ data }) => setAllotments(data))
      .catch(console.error);

    // Fetch Inspectors
    axiosInstance.get('/inspectors')
      .then(({ data }) => setInspectors(data))
      .catch(console.error);

    // Fetch Vendors — used to resolve the L1 vendor's display name (which lives in
    // VendorService, not on the allotment) from the allotment's l1VendorId.
    axiosInstance.get('/vendors')
      .then(({ data }) => setVendors(data))
      .catch(console.error);
  }, []);

  const handleTenderChange = (id: string) => {
    setTenderId(id);
    const allot = allotments.find(a => a.tenderId === id);
    if (allot) {
      setVendorId(allot.l1VendorId ?? '');
      setVendorName(vendors.find(v => v.id === allot.l1VendorId)?.name || allot.l1VendorName || '');
      setTenderBudget(allot.tenderBudget || 0);
      
      // Re-validate cost if tender changes
      if (totalValue > (allot.tenderBudget ?? 0)) {
        setCostError(`Cost exceeds Tender Budget (₹${(allot.tenderBudget ?? 0).toLocaleString('en-IN')})`);
      } else {
        setCostError('');
      }
    } else {
      setVendorId('');
      setVendorName('');
      setTenderBudget(0);
      setCostError('');
    }
  };

  const totalWeightage = milestones.reduce((sum, m) => sum + Number(m.weightage), 0);

  const addMilestone = () => setMilestones([...milestones, { title: '', weightage: 0, paymentPercentage: 0, targetDate: '' }]);

  const handleMilestoneChange = (index: number, field: string, value: string | number) => {
    const newM = [...milestones];
    newM[index] = { ...newM[index], [field]: value };
    setMilestones(newM);
  };

  const submitWorkOrder = async () => {
    if (totalWeightage !== 100) return alert('Total Weightage must equal exactly 100%.');
    if (!file) return alert('Please upload the digital agreement.');
    
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const { url } = (await axiosInstance.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })).data;

      const normalizedMilestones = milestones.map(m => ({
        ...m,
        weightage: Number(m.weightage),
        paymentPercentage: Number(m.paymentPercentage)
      }));

      // Step 1: create the Work Order (owned by TenderService).
      let createdWO;
      try {
        createdWO = (await axiosInstance.post('/workorders', {
          vendorId,
          tenderId,
          inspectorId,
          workOrderNo,
          totalValue,
          scopeDescription: scope,
          paymentTerms,
          liquidatedDamagesTerms,
          agreementDocumentUrl: url,
          startDate,
          endDate,
          milestones: normalizedMilestones
        })).data;
      } catch (e) {
        if (isAxiosError(e) && typeof e.response?.data === 'string' && e.response.data) {
          alert(e.response.data);
          return;
        }
        throw e;
      }

      // Step 2: persist the milestones (owned by ExecutionService) against the new Work Order.
      try {
        await axiosInstance.post('/execution/milestones', {
          workOrderId: createdWO.id,
          milestones: normalizedMilestones
        });
        alert('Work Order Draft Created!');
      } catch (e) {
        const detail = isAxiosError(e) && typeof e.response?.data === 'string' ? e.response.data : '';
        alert('Work Order was created, but saving milestones failed: ' + detail + '\nOpen the draft to retry.');
      }
      navigate('/admin/work-orders');
    } catch (e) {
      console.error(e);
      alert('Error creating work order draft');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <ConfirmDialog
        isOpen={removeIdx !== null}
        title="Remove Milestone?"
        message={removeIdx !== null ? `"${milestones[removeIdx]?.title || 'This milestone'}" will be removed. You cannot undo this.` : ''}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { setMilestones(milestones.filter((_, i) => i !== removeIdx)); setRemoveIdx(null); }}
        onCancel={() => setRemoveIdx(null)}
      />
      <div className="mb-8 flex justify-between items-center text-sm font-medium text-slate-600">
        <span className={step >= 1 ? 'text-blue-700' : ''}>1. Basic Details</span>
        <span className={step >= 2 ? 'text-blue-700' : ''}>2. Scope & Terms</span>
        <span className={step >= 3 ? 'text-blue-700' : ''}>3. Milestones</span>
        <span className={step >= 4 ? 'text-blue-700' : ''}>4. Digital Upload</span>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Tender, Vendor & Value</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Select Tender</label>
                <select aria-label="Select an option" value={tenderId} onChange={e => handleTenderChange(e.target.value)} className="w-full p-3 border rounded-lg bg-white">
                  <option value="">Select Awarded Tender...</option>
                  {allotments.map(a => <option key={a.id} value={a.tenderId}>{a.tenderTitle} ({a.tenderNo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Selected Vendor (L1)</label>
                <input type="text" value={vendorName} readOnly placeholder="Auto-filled from Tender" className="w-full p-3 border rounded-lg bg-slate-50 text-slate-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Work ID / WO No.</label>
                <input type="text" placeholder="e.g. WO-2024-001" value={workOrderNo} onChange={e => setWorkOrderNo(e.target.value)} className="w-full p-3 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Project Cost (Total Value)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-medium text-sm">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 2,00,00,000"
                    value={displayValue}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      const val = Number(raw);
                      setTotalValue(val);
                      setDisplayValue(raw ? val.toLocaleString('en-IN') : '');
                      
                      if (tenderBudget > 0 && val > tenderBudget) {
                        setCostError(`Cost exceeds Tender Budget (₹${tenderBudget.toLocaleString('en-IN')})`);
                      } else {
                        setCostError('');
                      }
                    }}
                    onFocus={() => { if (totalValue) setDisplayValue(String(totalValue)); }}
                    onBlur={() => { if (totalValue) setDisplayValue(totalValue.toLocaleString('en-IN')); }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${
                      costError ? 'border-red-500 focus:ring-red-100 bg-red-50/30' : 'focus:ring-blue-500'
                    }`}
                  />
                </div>
                <div className="h-5 mt-1">
                  {costError ? (
                    <p className="text-[10px] text-red-700 font-bold ml-1 uppercase tracking-tight">{costError}</p>
                  ) : tenderBudget > 0 ? (
                    <p className="text-[10px] text-slate-600 font-bold ml-1 uppercase tracking-tight">Max Budget: ₹{tenderBudget.toLocaleString('en-IN')}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 border rounded-lg" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Assign Inspector</label>
              <select aria-label="Select an option" value={inspectorId} onChange={e => setInspectorId(e.target.value)} className="w-full p-3 border rounded-lg bg-white">
                <option value="">-- Select Inspector --</option>
                {inspectors.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.type === '3rd Party' ? (i.companyName ?? '3rd Party') : 'Dept'})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => navigate('/admin/work-orders')}
                className="text-slate-600 px-6 py-2.5 rounded-lg font-medium border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!tenderId || !vendorId || !totalValue || !workOrderNo || !inspectorId || !startDate || !endDate || !!costError}
                className="bg-blue-700 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next Step
              </button>
            </div>
          </div>
        )}


        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Scope & Terms</h2>
            <textarea placeholder="Scope Description" rows={3} value={scope} onChange={e => setScope(e.target.value)} className="w-full p-3 border rounded-lg" />
            <textarea placeholder="Payment Terms" rows={3} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full p-3 border rounded-lg" />
            <textarea placeholder="Liquidated Damages / Penalty Terms" rows={3} value={liquidatedDamagesTerms} onChange={e => setLiquidatedDamagesTerms(e.target.value)} className="w-full p-3 border rounded-lg border-orange-200 bg-orange-50/30" />
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)} className="text-slate-600 px-6 py-2 rounded-lg border">Back</button>
              <button onClick={() => setStep(3)} disabled={!scope || !paymentTerms || !liquidatedDamagesTerms} className="bg-blue-700 text-white px-6 py-2 rounded-lg disabled:">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Milestone Definitions</h2>
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${totalWeightage === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                Total Weight: {totalWeightage}% {totalWeightage === 100 ? '✓' : `(need ${100 - totalWeightage}% more)`}
              </span>
            </div>

            <div className="w-full border border-slate-200 rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[38%]">
                      Milestone Title
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[18%]">
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Completion Weight</span>
                        <span className="relative group cursor-default">
                          <span className="text-slate-600 text-[10px] border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center font-bold leading-none select-none">i</span>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-44 bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-2 shadow-xl z-50 font-normal normal-case tracking-normal text-center leading-relaxed pointer-events-none">
                            % of physical work this milestone represents. All milestones must total 100%.
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </span>
                        </span>
                      </div>
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[18%]">
                      <div className="inline-flex items-center justify-center gap-1">
                        <span>Payment Release</span>
                        <span className="relative group cursor-default">
                          <span className="text-slate-600 text-[10px] border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center font-bold leading-none select-none">i</span>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-44 bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-2 shadow-xl z-50 font-normal normal-case tracking-normal text-center leading-relaxed pointer-events-none">
                            % of total contract value released to the vendor upon approving this milestone.
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </span>
                        </span>
                      </div>
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[22%]">
                      <div className="inline-flex items-center gap-1">
                        <span>Target Date</span>
                        <span className="relative group cursor-default">
                          <span className="text-slate-600 text-[10px] border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center font-bold leading-none select-none">i</span>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-40 bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-2 shadow-xl z-50 font-normal normal-case tracking-normal text-center leading-relaxed pointer-events-none">
                            Expected date by which this milestone should be completed.
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                          </span>
                        </span>
                      </div>
                    </th>
                    <th className="w-[4%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {milestones.map((m, i) => (
                    <tr key={i} className="bg-white hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          placeholder="e.g. Site Mobilization"
                          value={m.title}
                          onChange={e => handleMilestoneChange(i, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <input
                            type="number" min={0} max={100} placeholder="0"
                            value={m.weightage || ''}
                            onChange={e => handleMilestoneChange(i, 'weightage', e.target.value)}
                            className="w-full px-3 py-2 pr-7 border border-slate-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none">%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <input
                            type="number" min={0} max={100} placeholder="0"
                            value={m.paymentPercentage || ''}
                            onChange={e => handleMilestoneChange(i, 'paymentPercentage', e.target.value)}
                            className="w-full px-3 py-2 pr-7 border border-slate-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none">%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          value={m.targetDate}
                          onChange={e => handleMilestoneChange(i, 'targetDate', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {milestones.length > 1 && (
                          <button
                            onClick={() => setRemoveIdx(i)}
                            className="text-slate-300 hover:text-red-700 transition-colors text-base"
                            title="Remove milestone"
                          >✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addMilestone}
              className="flex items-center gap-1.5 text-blue-700 hover:text-blue-800 font-medium text-sm border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span><span>Add Milestone</span>
            </button>

            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(2)} className="text-slate-600 px-6 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Back</button>
              <button
                onClick={() => setStep(4)}
                disabled={totalWeightage !== 100 || milestones.some(m => !m.title || !m.targetDate)}
                className="bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >Next</button>
            </div>
          </div>
        )}



        {step === 4 && (
          <div className="space-y-6 text-center py-8">
            <h2 className="text-2xl font-semibold mb-2">Digital Agreement Upload</h2>
            <p className="text-slate-600 mb-6">Attach the finalized PDF prior to issuing this Work Order Draft.</p>
            <div className="border-2 border-dashed border-slate-300 bg-slate-50 p-12 rounded-xl text-slate-600 relative">
               {file ? (
                 <div className="flex flex-col items-center">
                   <span className="font-medium text-slate-800">{file.name}</span>
                   <button onClick={() => setFile(null)} className="text-red-700 text-sm mt-2">Remove</button>
                 </div>
               ) : (
                 <>
                   <p>Drag and drop or click to upload</p>
                   <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx" />
                 </>
               )}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(3)} disabled={uploading} className="text-slate-600 px-6 py-2 rounded-lg border">Back</button>
              <button onClick={submitWorkOrder} disabled={!file || uploading} className="bg-green-700 hover:bg-green-700 text-white px-8 py-2 rounded-lg text-lg shadow-lg font-bold disabled:">
                {uploading ? 'Uploading & Creating...' : 'Create Work Order Draft'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
