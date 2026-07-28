import { fetchVendorDashboard } from '../../api/dashboardService';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  TrendingUp,
  ChevronRight,
  
  Camera,
  History
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../../store';

interface DashboardStats {
  assignedWorkOrders: number;
  activeProjects: number;
  completedMilestones: number;
  totalMilestones: number;
  defectsToRectify: number;
  totalReworkCount: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  budget: number;
  milestonesDone: number;
  milestonesTotal: number;
}

export const VendorDashboard = () => {
  const [data, setData] = useState<{ stats: DashboardStats; bills: Record<string, number>; recentProjects: ProjectSummary[] } | null>(null);
  const { token, user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    fetchVendorDashboard()
    .then(setData)
    .catch(console.error);
  }, [token]);

  if (!data) return <div className="p-8">Loading Vendor Portal...</div>;


  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Welcome, {user?.name}</h1>
          <p className="text-slate-600 mt-1">Vendor Portal • 360° Progress Tracker</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center space-x-2 text-sm font-medium text-emerald-700">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span>System Connected</span>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Active</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Assigned Projects</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{data.stats.activeProjects}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">On-Track</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Completed Milestones</p>
          <div className="flex items-end space-x-2 mt-1">
            <p className="text-3xl font-bold text-slate-800">{data.stats.completedMilestones}</p>
            <p className="text-sm text-slate-600 pb-1">/ {data.stats.totalMilestones}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-100 text-red-700 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Attention</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Pending Reworks</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{data.stats.defectsToRectify}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Billing</span>
          </div>
          <p className="text-sm font-medium text-slate-600">RA Bills Pending</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{data.bills["Submitted"] || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Tracker Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Current Work Progress</h2>
            <button onClick={() => navigate('/vendor/work-orders')} className="text-blue-700 text-sm font-semibold hover:underline">View All Projects</button>
          </div>
          <div className="p-6 space-y-6">
            {data.recentProjects.map(proj => (
              <div key={proj.id} className="group p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{proj.name}</h2>
                    <p className="text-xs text-slate-600 mt-0.5">Budget: ₹{(proj.budget/100000).toFixed(2)}L • {proj.status}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                   <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-100">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{proj.milestonesDone}/{proj.milestonesTotal} Milestones</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-100">
                        <Camera className="w-3.5 h-3.5" />
                        <span>12 Evidence Files</span>
                      </div>
                   </div>
                   <button 
                     onClick={() => navigate('/vendor/progress')}
                     className="flex items-center text-xs font-bold text-blue-700 uppercase tracking-wider group-hover:translate-x-1 transition-transform"
                   >
                     Update Progress <ChevronRight className="w-4 h-4 ml-1" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bill Pipeline Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Bill Status Pipeline</h2>
          </div>
          <div className="p-6 flex-1">
            <div className="relative space-y-8 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              <div className="relative flex items-center space-x-4">
                <div className={`z-10 w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${data.bills["Submitted"] ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Submitted</p>
                  <p className="text-xs text-slate-600">{data.bills["Submitted"] || 0} bills under initial review</p>
                </div>
              </div>
              <div className="relative flex items-center space-x-4">
                <div className={`z-10 w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${data.bills["Under Review"] ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Verification</p>
                  <p className="text-xs text-slate-600">{data.bills["Under Review"] || 0} bills being verified by PMU</p>
                </div>
              </div>
              <div className="relative flex items-center space-x-4">
                <div className={`z-10 w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${data.bills["Approved"] ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Approved</p>
                  <p className="text-xs text-slate-600">{data.bills["Approved"] || 0} bills approved for payment</p>
                </div>
              </div>
              <div className="relative flex items-center space-x-4">
                <div className={`z-10 w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${data.bills["Paid"] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Paid</p>
                  <p className="text-xs text-slate-600">{data.bills["Paid"] || 0} bills settled recently</p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/vendor/bills')}
              className="w-full mt-10 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
            >
              Submit New RA Bill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



