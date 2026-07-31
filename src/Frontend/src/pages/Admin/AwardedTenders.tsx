import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus, FileText, Eye } from 'lucide-react';
import { TenderDetailsModal } from '../../components/TenderDetailsModal';
import axiosInstance from '../../api/axiosInstance';

interface Tender {
  id: string;
  tenderNo: string;
  title: string;
  description: string;
  budget: number;
  createdAt: string;
  hasWorkOrder: boolean;
}

export const AwardedTenders = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axiosInstance.get<Tender[]>('/tenders/awarded')
      .then(({ data }) => setTenders(data))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Awarded Tenders</h1>
          <p className="text-slate-600 mt-2">Manage tenders that have been awarded and require Work Order initiation.</p>
        </div>
        <button 
          onClick={() => navigate('/admin/masters/allotted-tenders')}
          className="mt-4 sm:mt-0 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-card font-bold shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          <FilePlus className="w-5 h-5" /> Award Tender
        </button>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="py-4 px-6">Tender Title</th>
              <th className="py-4 px-6">Budget</th>
              <th className="py-4 px-6">Award Date</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...tenders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(tender => (
              <tr key={tender.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-brand-500" />
                    <div>
                      <p className="font-medium text-slate-800">{tender.title}</p>
                      <p className="text-xs text-slate-600 truncate max-w-xs">{tender.description}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 font-medium text-slate-700">₹{tender.budget.toLocaleString('en-IN')}</td>
                <td className="py-4 px-6 text-slate-600">{new Date(tender.createdAt).toLocaleDateString()}</td>
                <td className="py-4 px-6 text-right flex justify-end items-center space-x-2">
                  <button 
                    onClick={() => setSelectedTender(tender)}
                    className="p-2 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-control transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  
                  {!tender.hasWorkOrder ? (
                    <button 
                      onClick={() => navigate(`/admin/work-orders/new?tenderId=${tender.id}`)}
                      className="inline-flex items-center space-x-1 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-control text-sm font-medium transition-colors"
                    >
                      <FilePlus className="w-4 h-4" />
                      <span>Initiate Work Order</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      WO Created
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {tenders.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-600">No awarded tenders found.</td>
              </tr>
            )}
          </tbody>
        </table></div>
      </div>

      <TenderDetailsModal 
        tender={selectedTender} 
        onClose={() => setSelectedTender(null)} 
      />
    </div>
  );
};

