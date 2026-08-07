import React, { useState } from 'react';
import { CITY_TYPES, cityTypeLabel, type LocationRow } from '../../../api/locationsService';
import { useLocationMaster, type LocationDraft } from './useLocationMaster';

const inputCls = 'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1';

const empty: LocationDraft = {
  name: '', code: '', locationType: 'Ulb', ulbType: '', parentLocationId: null, isActive: true,
};

const CityMaster: React.FC = () => {
  const { rows, loading, loadError, saveError, refresh, save, remove } = useLocationMaster({ type: 'Ulb' });
  const [form, setForm] = useState<LocationDraft>(empty);
  const [editId, setEditId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await save(form, editId)) { setForm(empty); setEditId(''); }
  };

  const startEdit = (r: LocationRow) => {
    setForm({ name: r.name, code: r.code, locationType: 'Ulb', ulbType: r.ulbType ?? '', parentLocationId: null, isActive: r.isActive });
    setEditId(r.id);
  };

  const cancelEdit = () => { setForm(empty); setEditId(''); };

  const onDelete = async (r: LocationRow) => {
    if (!window.confirm(`Delete ${r.name}?`)) return;
    await remove(r.id);
  };

  const visible = rows.filter((r) => {
    if (typeFilter && r.ulbType !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Cities</h1>
      <p className="text-slate-600 mb-8">
        Metropolitan cities are divided into zones; cities and towns hold their wards directly.
      </p>

      <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
        <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} City</h2>
        <form onSubmit={submit} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={labelCls}>Code</label>
            <input className={inputCls} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className={labelCls}>City Type</label>
            <select aria-label="City Type" className={inputCls} value={form.ulbType ?? ''}
              onChange={(e) => setForm({ ...form, ulbType: e.target.value })} required>
              <option value="">Select city type</option>
              {CITY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label} ({t.native})</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
            {editId ? 'Update' : 'Save'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
              Cancel
            </button>
          )}
        </form>
      </div>

      {(loadError || saveError) && (
        <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 flex items-start justify-between gap-4">
          <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
          {loadError && (
            <button type="button" onClick={refresh} className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800">Retry</button>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-card shadow-sm border border-slate-200 mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <label className={labelCls}>City Type</label>
          <select aria-label="Filter by city type" className={inputCls} value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {CITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className={labelCls}>Search</label>
          <input className={inputCls} placeholder="Search by name or code" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-slate-600 pb-2">Showing {visible.length} of {rows.length}</p>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">City Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{r.name}</td>
                <td className="px-6 py-4 text-slate-600">{r.code}</td>
                <td className="px-6 py-4 text-slate-600">{cityTypeLabel(r.ulbType)}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => startEdit(r)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                  <button onClick={() => onDelete(r)} className="text-red-700 font-bold underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!loading && !loadError && rows.length === 0 && <div className="p-10 text-center text-slate-600">No cities yet.</div>}
        {!loading && !loadError && rows.length > 0 && visible.length === 0 && <div className="p-10 text-center text-slate-600">No cities match the current filter.</div>}
      </div>
    </div>
  );
};

export default CityMaster;
