import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  Wallet, 
   
  History, 
   
  ShieldCheck,
  Plus,
  FileText,
  Clock
} from 'lucide-react';
import type { RootState } from '../../store';
import { SubmitBillModal } from './SubmitBillModal';
import axiosInstance from '../../api/axiosInstance';

interface Bill {
  id: string;
  billNo: string;
  type: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  submittedAt: string;
  paymentVoucherNo?: string;
  paidAt?: string;
  rejectionReason?: string;
}

export const BillingClaims = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [showSubmit, setShowSubmit] = useState(false);
  const { token } = useSelector((state: RootState) => state.auth);

  const loadBills = () => {
    axiosInstance.get('/bills')
      .then(res => setBills(res.data ?? []))
      .catch(console.error);
  };

  useEffect(loadBills, [token]);

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-indigo-600" />
            Billing & Payment Claims
          </h1>
          <p className="text-slate-600 mt-2">Manage RA bills, track payment disbursements, and link work completions.</p>
        </div>
        <button 
          onClick={() => setShowSubmit(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Raise New Claim
        </button>
      </div>

      {showSubmit && (
        <SubmitBillModal 
          onClose={() => setShowSubmit(false)} 
          onSuccess={() => {
            setShowSubmit(false);
            loadBills();
          }}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Total Paid</p>
          <p className="text-3xl font-black text-slate-800 mt-1">₹{bills.filter(b => b.status === 'Paid').reduce((acc, b) => acc + b.totalAmount, 0).toLocaleString('en-IN')}</p>
          <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold mt-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Disbursements</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Pending Review</p>
          <p className="text-3xl font-black text-slate-800 mt-1">₹{bills.filter(b => b.status === 'Submitted').reduce((acc, b) => acc + b.totalAmount, 0).toLocaleString('en-IN')}</p>
          <div className="flex items-center gap-1 text-amber-700 text-xs font-bold mt-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Currently with PMU</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm bg-indigo-600">
           <p className="text-sm font-bold text-indigo-700 uppercase tracking-widest">Active Claims</p>
           <p className="text-3xl font-black text-white mt-1">{bills.filter(b => b.status !== 'Paid').length}</p>
           <p className="text-xs text-indigo-700 mt-2 font-medium">Running Account (RA) cycle</p>
        </div>
      </div>

      {/* Billing History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            Recent Claim History
          </h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">All Projects</span>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-bold text-slate-600 uppercase tracking-widest border-b border-slate-100">
              <th className="px-6 py-4">Bill Details</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount (Gross)</th>
              <th className="px-6 py-4">Submitted On</th>
              <th className="px-6 py-4">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {bills.map(bill => (
              <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <FileText className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{bill.billNo}</p>
                      <p className="text-xs text-slate-600">{bill.type} Bill</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                   <div className="flex flex-col items-start gap-2">
                     <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                       bill.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                       bill.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
                       bill.status === 'Returned' || bill.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                       'bg-amber-100 text-amber-700'
                     }`}>
                       {bill.status}
                     </span>
                     {(bill.status === 'Returned' || bill.status === 'Rejected') && bill.rejectionReason && (
                       <div className="text-[10px] bg-red-50 text-red-700 p-2 rounded border border-red-100 max-w-xs">
                         <span className="font-bold">Reason:</span> {bill.rejectionReason}
                       </div>
                     )}
                   </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <p className="font-bold text-slate-800">₹{bill.totalAmount.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-600">Tax: ₹{bill.taxAmount.toLocaleString('en-IN')}</p>
                </td>
                <td className="px-6 py-5">
                  <p className="text-sm font-medium text-slate-700">{new Date(bill.submittedAt).toLocaleDateString()}</p>
                </td>
                <td className="px-6 py-5">
                  {bill.paymentVoucherNo ? (
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">VCH: {bill.paymentVoucherNo}</span>
                      <span className="text-[10px] text-slate-600 font-medium">Disbursed: {new Date(bill.paidAt!).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600 italic">Processing...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
};
