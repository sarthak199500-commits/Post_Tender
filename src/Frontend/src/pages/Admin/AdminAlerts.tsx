import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchNotifications, timeAgo } from '../../api/notificationsService';
import type { AppNotification } from '../../api/notificationsService';

export const AdminAlerts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Same derived feed the topbar bell uses — real signals from the services,
  // since there is no Alert entity in the backend.
  useEffect(() => {
    let cancelled = false;
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    if (!u) { setLoading(false); return; }
    fetchNotifications(u.role, u.id, { force: true })
      .then(list => { if (!cancelled) setAlerts(list); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredAlerts = alerts.filter(a =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-700" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-700" />;
      default: return <Info className="w-5 h-5 text-brand-700" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-50 border-red-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      case 'success': return 'bg-emerald-50 border-emerald-100';
      default: return 'bg-brand-50 border-brand-100';
    }
  };

  return (
    <div className="space-y-8">
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
          className="bg-amber-700 hover:bg-amber-800 text-white px-6 py-2.5 rounded-card font-bold flex items-center gap-2 shadow-lg shadow-amber-100 transition-colors"
        >
          <Bell className="w-4 h-4" /> Raise Alert
        </Link>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800">Recent Alerts</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600" />
            <input 
              type="text" 
              placeholder="Search alerts..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-control text-sm focus:ring-2 focus:ring-amber-500 outline-none w-64 bg-slate-50"
            />
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-600 font-medium">Loading alerts…</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-10 text-slate-600 font-medium">
              {alerts.length === 0 ? 'No active alerts — everything is on track.' : 'No alerts match your search.'}
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => alert.link && navigate(alert.link)}
                className={`flex items-start gap-4 p-4 rounded-card border ${getBg(alert.type)} transition-colors ${alert.link ? 'cursor-pointer hover:brightness-95' : ''}`}
              >
                <div className="mt-1 p-2 bg-white rounded-full shadow-sm">
                  {getIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <h2 className="font-bold text-slate-800">{alert.title}</h2>
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{timeAgo(alert.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 font-medium">{alert.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
