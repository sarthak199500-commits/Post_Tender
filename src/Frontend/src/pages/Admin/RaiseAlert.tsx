import React, { useState } from 'react';
import { Bell, Send, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import { invalidateNotifications } from '../../api/notificationsService';

// An alert targets at most one role, so a grouped audience fans out to one alert per
// role in that group. "All Users" is a single untargeted broadcast.
const AUDIENCE_ROLES: Record<string, (string | null)[]> = {
  all: [null],
  vendors: ['Vendor'],
  inspectors: ['Inspector'],
  internal: ['Admin', 'PMU', 'Finance', 'Department'],
};

export const RaiseAlert = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    severity: 'info',
    targetAudience: 'all'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      setError('A title and a message are both required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const targets = AUDIENCE_ROLES[formData.targetAudience] ?? [null];
      // Sequential rather than parallel: a partial failure mid-fan-out should stop
      // rather than leave an unpredictable subset delivered.
      for (const targetRole of targets) {
        await axiosInstance.post('/alerts', {
          type: formData.severity,
          title: formData.title.trim(),
          message: formData.message.trim(),
          targetRole,
        });
      }
      invalidateNotifications();
      navigate('/admin/alerts');
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data
          ? err.response.data
          : 'Could not broadcast the alert. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-amber-700" />
            Raise New Alert
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Broadcast a system alert or notification to users.</p>
        </div>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-slate-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-card flex gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Alert Title</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full border border-slate-200 rounded-card p-3 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50"
              placeholder="e.g., System Maintenance Scheduled"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Alert Message</label>
            <textarea 
              required
              rows={4}
              value={formData.message}
              onChange={e => setFormData({...formData, message: e.target.value})}
              className="w-full border border-slate-200 rounded-card p-3 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50"
              placeholder="Provide details about the alert..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Severity Level</label>
              <select aria-label="Select an option" 
                value={formData.severity}
                onChange={e => setFormData({...formData, severity: e.target.value})}
                className="w-full border border-slate-200 rounded-card p-3 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50 font-medium"
              >
                <option value="info">Info (Blue)</option>
                <option value="warning">Warning (Amber)</option>
                <option value="critical">Critical (Red)</option>
                <option value="success">Success (Green)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Target Audience</label>
              <select aria-label="Select an option" 
                value={formData.targetAudience}
                onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                className="w-full border border-slate-200 rounded-card p-3 focus:ring-2 focus:ring-amber-500 outline-none bg-slate-50 font-medium"
              >
                <option value="all">All Users</option>
                <option value="vendors">Vendors Only</option>
                <option value="inspectors">Inspectors Only</option>
                <option value="internal">Internal Team Only</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => navigate('/admin/alerts')}
              className="px-6 py-2.5 rounded-card font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="bg-amber-700 hover:bg-amber-800 text-white px-6 py-2.5 rounded-card font-bold flex items-center gap-2 shadow-lg shadow-amber-100 transition-colors disabled:"
            >
              {loading ? 'Broadcasting...' : <><Send className="w-4 h-4" /> Broadcast Alert</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
