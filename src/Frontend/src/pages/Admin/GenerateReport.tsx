import React, { useState } from 'react';
import { FileText, Download, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GenerateReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reportType: 'financial',
    dateRange: 'this_month',
    department: 'all'
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate generation
    setTimeout(() => {
      setLoading(false);
      alert('Report generated and downloaded successfully!');
      navigate('/admin/reports');
    }, 1500);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            Generate MIS Report
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Export custom data reports for analysis and auditing.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-2xl flex gap-8">
        <div className="flex-1 space-y-6">
          <form id="reportForm" onSubmit={handleGenerate} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Report Type</label>
              <select aria-label="Select an option" 
                value={formData.reportType}
                onChange={e => setFormData({...formData, reportType: e.target.value})}
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-600 outline-none bg-slate-50 font-medium"
              >
                <option value="financial">Financial Disbursements Summary</option>
                <option value="work_orders">Work Order Progress Status</option>
                <option value="vendors">Vendor Performance & Ratings</option>
                <option value="defects">Quality Defects Overview</option>
                <option value="audit">System Audit Logs</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Date Range</label>
                <select aria-label="Select an option" 
                  value={formData.dateRange}
                  onChange={e => setFormData({...formData, dateRange: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-600 outline-none bg-slate-50 font-medium"
                >
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="last_quarter">Last Quarter</option>
                  <option value="ytd">Year to Date</option>
                  <option value="custom">Custom Range...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Department</label>
                <select aria-label="Select an option" 
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-600 outline-none bg-slate-50 font-medium"
                >
                  <option value="all">All Departments</option>
                  <option value="civil">Civil Engineering</option>
                  <option value="electrical">Electrical Works</option>
                  <option value="it">IT & Infrastructure</option>
                </select>
              </div>
            </div>
          </form>

          <div className="pt-4 flex gap-3 border-t border-slate-100">
            <button 
              type="submit"
              form="reportForm"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 transition-colors disabled:"
            >
              {loading ? 'Generating...' : <><Download className="w-4 h-4" /> Export Report (CSV)</>}
            </button>
            <button 
              type="button"
              onClick={() => navigate('/admin/reports')}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        
        <div className="w-64 bg-slate-50 rounded-xl p-6 border border-slate-100 h-fit hidden sm:block">
          <Filter className="w-6 h-6 text-indigo-400 mb-3" />
          <h2 className="font-bold text-slate-700 mb-2">Report Details</h2>
          <p className="text-sm text-slate-600 mb-4">You are about to generate a comprehensive {formData.reportType.replace('_', ' ')} report for {formData.department} department.</p>
          <ul className="text-xs space-y-2 text-slate-600 font-medium list-disc pl-4">
            <li>Includes soft-deleted records</li>
            <li>Contains financial figures</li>
            <li>Exports in CSV format</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
