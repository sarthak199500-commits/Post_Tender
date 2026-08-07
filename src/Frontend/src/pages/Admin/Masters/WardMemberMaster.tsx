import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance';
import { describeApiError } from '../../../api/apiError';
import { LocationCascade, type LocationValue } from '../../../components/LocationCascade';
import type { WardMemberRow } from '../../../api/locationsService';

const inputCls =
  'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';

const empty = { name: '', designation: '', phone: '', email: '' };

const WardMemberMaster: React.FC = () => {
  const [data, setData] = useState<WardMemberRow[]>([]);
  const [wardNames, setWardNames] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue>({ ulbId: '', zoneId: '', wardId: '' });
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState('');

  const fetchData = async () => {
    try {
      const [members, locations] = await Promise.all([
        axiosInstance.get<WardMemberRow[]>('/masters/wardmembers'),
        axiosInstance.get<{ id: string; name: string }[]>('/masters/locations', { params: { type: 'Ward' } }),
      ]);
      setData(members.data ?? []);
      setWardNames(new Map((locations.data ?? []).map((l) => [l.id, l.name])));
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setData([]);
      setLoadError(describeApiError(err, 'Could not load ward members'));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!location.wardId) { setSaveError('Select a ward first.'); return; }
    try {
      const body = { ...form, wardId: location.wardId, isActive: true };
      if (editId) await axiosInstance.put(`/masters/wardmembers/${editId}`, body);
      else await axiosInstance.post('/masters/wardmembers', body);
      setForm(empty);
      setEditId('');
      fetchData();
    } catch (err) {
      setSaveError(describeApiError(err, 'Failed to save'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this ward member?')) return;
    try {
      await axiosInstance.delete(`/masters/wardmembers/${id}`);
      fetchData();
    } catch (err) {
      setSaveError(describeApiError(err, 'Failed to delete'));
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Ward Members</h1>

      <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
        <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} Ward Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LocationCascade value={location} onChange={setLocation} />
          {editId && !location.ulbId && (
            <p className="text-sm text-slate-500">
              Currently assigned to <strong className="text-slate-700">{wardNames.get(location.wardId) ?? 'this ward'}</strong>.
              Pick a municipality and ward above only if you want to move this member.
            </p>
          )}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input className={inputCls} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Designation</label>
              <input className={inputCls} placeholder="Sabhasad" value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
              <input className={inputCls} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input className={inputCls} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
              {editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {(loadError || saveError) && (
        <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
        </div>
      )}

      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Ward</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Designation</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{m.name}</td>
                <td className="px-6 py-4 text-slate-600">{wardNames.get(m.wardId) ?? '—'}</td>
                <td className="px-6 py-4 text-slate-600">{m.designation || '—'}</td>
                <td className="px-6 py-4 text-slate-600">{m.phone || m.email || '—'}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => { setEditId(m.id); setForm({ name: m.name, designation: m.designation ?? '', phone: m.phone ?? '', email: m.email ?? '' }); setLocation({ ulbId: '', zoneId: '', wardId: m.wardId }); }}
                    className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                  <button onClick={() => handleDelete(m.id)}
                    className="text-red-700 font-bold underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {data.length === 0 && !loadError && <div className="p-10 text-center text-slate-600">No ward members yet.</div>}
      </div>
    </div>
  );
};

export default WardMemberMaster;
