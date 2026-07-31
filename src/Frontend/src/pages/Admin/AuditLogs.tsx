import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Search } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

interface AuditLog {
  id: string;
  entityName: string;
  recordId: string;
  action: string;
  userName: string;
  userRole: string;
  timestamp: string;
  changesInfo: string;
}

// Entity type is a category, not a state. Four distinct tones from the palette —
// `purple` was the last hue in the app that belonged to no scale at all.
const entityColors: Record<string, string> = {
  WorkOrder: 'bg-brand-100 text-brand-700',
  Project: 'bg-emerald-100 text-emerald-700',
  Vendor: 'bg-amber-100 text-amber-700',
  Bill: 'bg-slate-100 text-slate-600',
};

export const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  // Prefilled from ?q= so other pages can deep-link an entity's history into this view.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    axiosInstance.get<AuditLog[]>('/auditlogs')
      .then(({ data }) => setLogs(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l =>
    l.entityName.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.userName.toLowerCase().includes(search.toLowerCase()) ||
    l.changesInfo.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-slate-600">Loading audit logs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center space-x-3">
            <Shield className="w-8 h-8 text-brand-600" />
            <span>Audit & Compliance Logs</span>
          </h1>
          <p className="text-slate-600 mt-1">Complete trail of all administrative actions in the system.</p>
        </div>
        <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-control px-3 py-2">
          <Search className="w-4 h-4 text-slate-600" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="outline-none text-sm text-slate-700 w-56"
          />
        </div>
      </div>

      <div className="bg-white rounded-card border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-xs uppercase tracking-wider">
            <tr>
              <th className="py-3 px-5">Timestamp</th>
              <th className="py-3 px-5">Entity</th>
              <th className="py-3 px-5">Action</th>
              <th className="py-3 px-5">Performed By</th>
              <th className="py-3 px-5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-5 text-slate-600 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-3 px-5">
                  <span className={`px-2 py-1 rounded-control text-xs font-semibold ${entityColors[log.entityName] || 'bg-slate-100 text-slate-600'}`}>
                    {log.entityName}
                  </span>
                </td>
                <td className="py-3 px-5 font-medium text-slate-700">{log.action}</td>
                <td className="py-3 px-5">
                  <div>
                    <p className="font-medium text-slate-800">{log.userName}</p>
                    <p className="text-xs text-slate-600">{log.userRole}</p>
                  </div>
                </td>
                <td className="py-3 px-5 text-slate-600 max-w-sm truncate">{log.changesInfo}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-600">No audit logs found.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

      <p className="text-xs text-slate-600 text-right">Total records: {filtered.length}</p>
    </div>
  );
};
