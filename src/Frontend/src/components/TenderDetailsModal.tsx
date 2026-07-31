import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { X, FileText, Calendar, Wallet, Users } from 'lucide-react';
import type { RootState } from '../store';
import axiosInstance from '../api/axiosInstance';

interface Tender {
  id: string;
  tenderNo: string;
  title: string;
  description: string;
  budget: number;
  createdAt: string;
}

interface Allotment {
  tenderId: string;
  l1VendorName?: string;
  l2VendorName?: string;
  l3VendorName?: string;
}

interface Props {
  tender: Tender | null;
  onClose: () => void;
}

export const TenderDetailsModal = ({ tender, onClose }: Props) => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [allotment, setAllotment] = useState<Allotment | null>(null);

  useEffect(() => {
    if (tender && token) {
      axiosInstance.get<Allotment[]>('/tenderallotments')
        .then(({ data }) => {
          const found = data.find(a => a.tenderId === tender.id);
          if (found) setAllotment(found);
        })
        .catch(console.error);
    }
  }, [tender, token]);

  if (!tender) return null;

  return (
    <div className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-800">Tender Specifications</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-700 text-[10px] font-bold tracking-wider uppercase">
                {tender.tenderNo || 'REF-TND-2024'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{tender.title}</h1>
            <p className="text-slate-600 mt-2 leading-relaxed">{tender.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-card bg-slate-50 border border-slate-100 flex items-start space-x-3">
              <Wallet className="w-5 h-5 text-brand-500 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Budget</p>
                <p className="text-lg font-bold text-slate-900">₹{tender.budget.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="p-4 rounded-card bg-slate-50 border border-slate-100 flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-brand-500 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Award Date</p>
                <p className="text-lg font-bold text-slate-900">{new Date(tender.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            
            {allotment && (
              <div className="col-span-2 p-4 rounded-card bg-slate-50 border border-slate-100 flex items-start space-x-3 mt-2">
                <Users className="w-5 h-5 text-brand-500 mt-0.5" />
                <div className="w-full">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Awarded Vendors</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">L1</span>
                      <p className="text-sm font-semibold text-slate-800 mt-1">{allotment.l1VendorName || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">L2</span>
                      <p className="text-sm font-semibold text-slate-800 mt-1">{allotment.l2VendorName || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">L3</span>
                      <p className="text-sm font-semibold text-slate-800 mt-1">{allotment.l3VendorName || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-brand-50 border border-brand-100 rounded-card p-4">
             <h4 className="text-sm font-bold text-brand-900 mb-1">Administrative Note:</h4>
             <p className="text-sm text-brand-700">This tender has been awarded. The Work Order must be initiated within 15 days of the award date to maintain compliance with departmental guidelines.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-control transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
