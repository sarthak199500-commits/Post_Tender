import React, { useState } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const MOCK_ALERTS = [
  { id: 1, type: 'critical', title: 'Payment Delayed', message: 'Work Order #WO-2024-001 bill payment is overdue by 5 days.', time: '2 hours ago' },
  { id: 2, type: 'warning', title: 'Milestone Submission Pending', message: 'Vendor TechCorp has not submitted Milestone 2 for approval.', time: '5 hours ago' },
  { id: 3, type: 'info', title: 'New Tender Published', titleMessage: 'Tender TND-005 has been published and is open for bids.', time: '1 day ago' },
  { id: 4, type: 'success', title: 'Project Completed', message: 'Work Order #WO-2023-099 has been officially closed.', time: '2 days ago' },
];

export const AdminAlerts = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAlerts = MOCK_ALERTS.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.message || a.titleMessage || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-700" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-700" />;
      default: return <Info className="w-5 h-5 text-blue-700" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-50 border-red-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      case 'success': return 'bg-emerald-50 border-emerald-100';
      default: return 'bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-amber-700" />
            System Alerts & Notifications
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Monitor system events, delays, and critical project updates.</p>
        </div>
        <Link 
          to="/admin/alerts/raise"
          className="bg-amber-700 hover:bg-amber-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-100 transition-colors"
        >
          <Bell className="w-4 h-4" /> Raise Alert
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800">Recent Alerts</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600" />
            <input 
              type="text" 
              placeholder="Search alerts..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none w-64 bg-slate-50"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-10 text-slate-600 font-medium">No alerts found.</div>
          ) : (
            filteredAlerts.map(alert => (
              <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-xl border ${getBg(alert.type)} transition-colors`}>
                <div className="mt-1 p-2 bg-white rounded-full shadow-sm">
                  {getIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h2 className="font-bold text-slate-800">{alert.title}</h2>
                    <span className="text-xs font-bold text-slate-600">{alert.time}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 font-medium">{alert.message || alert.titleMessage}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
