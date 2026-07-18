import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import type { RootState } from '../../store';
import { rupeesCompact } from '../../utils/currency';
import axiosInstance from '../../api/axiosInstance';

interface SubmitBillModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const SubmitBillModal: React.FC<SubmitBillModalProps> = ({ onClose, onSuccess }) => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWO, setSelectedWO] = useState<string>('');
  const [woDetails, setWoDetails] = useState<any>(null);
  
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch Work Orders
  useEffect(() => {
    axiosInstance.get('/workorders')
      .then(res => setWorkOrders((res.data ?? []).filter((w: any) => w.status === 'Accepted')))
      .catch(() => setError('Failed to load work orders'));
  }, [token]);

  // Fetch WO Details when selected
  useEffect(() => {
    if (!selectedWO) {
      setWoDetails(null);
      setSelectedMilestones([]);
      return;
    }
    setLoading(true);
    axiosInstance.get(`/workorders/${selectedWO}`)
      .then(res => {
        setWoDetails(res.data);
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
    const percentage = woDetails.milestones
      .filter((m: any) => selectedMilestones.includes(m.id))
      .reduce((acc: number, m: any) => acc + m.paymentPercentage, 0);
    return totalValue * (percentage / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWO || selectedMilestones.length === 0) {
      setError('Please select a work order and at least one completed milestone.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const amount = calculateAmount();
    // Simulate File Upload
    const attachmentUrl = file ? `/uploads/${file.name}` : '/uploads/invoice.pdf';
    
    const payload = {
      workOrderId: selectedWO,
      billNo: `BILL-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      type: 'RA',
      amount: amount, 
      taxAmount: amount * 0.18,
      attachmentUrl,
      milestoneIds: selectedMilestones
    };

    try {
      await axiosInstance.post('/bills', payload);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data ?? 'Failed to submit bill');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800">Raise New Claim</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <form id="billForm" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Work Order</label>
              <select aria-label="Select an option" 
                value={selectedWO} 
                onChange={e => setSelectedWO(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none bg-slate-50 font-medium"
              >
                <option value="">-- Select Work Order --</option>
                {workOrders.map(wo => (
                  <option key={wo.id} value={wo.id}>{wo.workOrderNo} (Milestones: {wo.completedMilestones}/{wo.milestoneCount})</option>
                ))}
              </select>
            </div>

            {woDetails && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Completed Milestones</label>
                <div className="space-y-3">
                  {woDetails.milestones.filter((m: any) => m.status === 'Completed').map((m: any) => (
                    <label key={m.id} className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-colors group">
                      <div className="mt-0.5">
                        <input 
                          type="checkbox" 
                          checked={selectedMilestones.includes(m.id)}
                          onChange={() => toggleMilestone(m.id)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600"
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
                  {woDetails.milestones.filter((m: any) => m.status === 'Completed').length === 0 && (
                    <div className="p-4 bg-slate-50 text-slate-600 rounded-xl text-center text-sm border border-slate-100">
                      No completed milestones available to bill for this Work Order.
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedMilestones.length > 0 && (
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-emerald-800 font-bold mb-2">Calculated Claim Amount</p>
                <div className="flex justify-between items-end">
                  <p className="text-3xl font-black text-emerald-700">{rupeesCompact(calculateAmount())}</p>
                  <p className="text-sm font-medium text-emerald-700/80 mb-1">+ 18% GST (auto-applied)</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Invoice Document (PDF)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 hover:border-indigo-300 transition-colors cursor-pointer">
                <input type="file" id="invoiceFile" className="hidden" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                <label htmlFor="invoiceFile" className="cursor-pointer">
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-indigo-500" />
                      <p className="font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-600">Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-slate-700">Click to upload invoice</p>
                      <p className="text-xs text-slate-600">PDF up to 10MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button 
            type="submit" 
            form="billForm"
            disabled={loading || selectedMilestones.length === 0} 
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-all disabled: shadow-md shadow-indigo-100"
          >
            {loading ? 'Submitting...' : <><CheckCircle className="w-4 h-4" /> Submit Claim</>}
          </button>
        </div>
      </div>
    </div>
  );
};
