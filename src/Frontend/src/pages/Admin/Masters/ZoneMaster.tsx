import React, { useEffect, useState } from 'react';
import { fetchUlbs, type LocationRow } from '../../../api/locationsService';
import { useLocationMaster, type LocationDraft } from './useLocationMaster';

const inputCls = 'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1';

const ZoneMaster: React.FC = () => {
  // Only a metropolitan city may have zones — that is a rule, not a property of the data, so
  // the picker is narrowed by tier rather than by "which cities happen to have zones today".
  const [cities, setCities] = useState<LocationRow[]>([]);
  const [cityId, setCityId] = useState('');
  const [cityError, setCityError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editId, setEditId] = useState('');

  const { rows, loading, loadError, saveError, refresh, save, remove } =
    useLocationMaster({ type: 'Zone', parentId: cityId, enabled: !!cityId });

  useEffect(() => {
    fetchUlbs('NagarNigam')
      .then(setCities)
      .catch(() => setCityError('Could not load metropolitan cities.'));
  }, []);

  const reset = () => { setName(''); setCode(''); setEditId(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft: LocationDraft = {
      name, code, locationType: 'Zone', ulbType: null, parentLocationId: cityId, isActive: true,
    };
    if (await save(draft, editId)) reset();
  };

  const startEdit = (r: LocationRow) => { setName(r.name); setCode(r.code); setEditId(r.id); };

  const onDelete = async (r: LocationRow) => {
    if (!window.confirm(`Delete ${r.name}? Its wards must be moved or deleted first.`)) return;
    await remove(r.id);
  };

  const cityName = cities.find((c) => c.id === cityId)?.name ?? '';

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Zones</h1>
      <p className="text-slate-600 mb-8">
        Only metropolitan cities are divided into zones. Pick a city to see and manage its zones.
      </p>

      <div className="bg-white p-4 rounded-card shadow-sm border border-slate-200 mb-6">
        <div className="max-w-md">
          <label className={labelCls}>Metropolitan City</label>
          <select aria-label="Metropolitan City" className={inputCls} value={cityId}
            onChange={(e) => { setCityId(e.target.value); reset(); }}>
            <option value="">Select a city</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {cityError && <p className="text-sm text-red-700 font-medium mt-3">{cityError}</p>}
      </div>

      {!cityId ? (
        <div className="bg-white rounded-card border border-slate-200 p-10 text-center text-slate-600">
          Select a metropolitan city above to manage its zones.
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
            <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} Zone in {cityName}</h2>
            <form onSubmit={submit} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className={labelCls}>Name</label>
                <input className={inputCls} placeholder="e.g. Zone 1" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className={labelCls}>Code</label>
                <input className={inputCls} placeholder="e.g. NN-LKO-Z01" value={code}
                  onChange={(e) => setCode(e.target.value)} required />
              </div>
              <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
                {editId ? 'Update' : 'Save'}
              </button>
              {editId && (
                <button type="button" onClick={reset} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
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

          <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{r.name}</td>
                    <td className="px-6 py-4 text-slate-600">{r.code}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => startEdit(r)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                      <button onClick={() => onDelete(r)} className="text-red-700 font-bold underline text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {!loading && !loadError && rows.length === 0 && (
              <div className="p-10 text-center text-slate-600">{cityName} has no zones yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ZoneMaster;
