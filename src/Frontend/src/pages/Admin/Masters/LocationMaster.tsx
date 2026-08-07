import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance';
import { describeApiError } from '../../../api/apiError';
import { ULB_TYPES } from '../../../api/locationsService';

interface Location {
    id: string;
    name: string;
    code: string;
    locationType: string;
    ulbType?: string | null;
    parentLocationId?: string | null;
    isActive: boolean;
    createdAt: string;
}

const emptyForm = { name: '', code: '', locationType: '', ulbType: '', parentLocationId: '' };

const LocationMaster: React.FC = () => {
    const [data, setData] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Location>>(emptyForm);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState('');

    // The seed data carries ~1,588 rows (17 + 201 ULBs + 1,370 wards). A flat unpaginated
    // table can't show all of that usefully, so the table is filtered client-side. Level
    // defaults to Ulb so the page opens on the 218 governing bodies rather than the wards.
    const [levelFilter, setLevelFilter] = useState('Ulb');
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        try {
            const res = await axiosInstance.get('/masters/locations');
            setData(res.data);
            setLoadError(null);
        } catch (err) {
            // Swallowing this made a stopped service look like an empty master.
            console.error(err);
            setData([]);
            setLoadError(describeApiError(err, 'Could not load this master'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        try {
            if (isEditing) {
                await axiosInstance.put(`/masters/locations/${editId}`, formData);
            } else {
                await axiosInstance.post('/masters/locations', formData);
            }
            setFormData(emptyForm);
            setIsEditing(false);
            setEditId('');
            fetchData();
        } catch (err) {
            setSaveError(describeApiError(err, 'Failed to save'));
        }
    };

    const handleEdit = (item: Location) => {
        setFormData(item);
        setIsEditing(true);
        setEditId(item.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await axiosInstance.delete(`/masters/locations/${id}`);
            fetchData();
        } catch (err) {
            setSaveError(describeApiError(err, 'Failed to delete'));
        }
    };

    const nameById = new Map(data.map(l => [l.id, l.name]));

    const filteredData = data.filter(item => {
        if (levelFilter && item.locationType !== levelFilter) return false;
        const q = search.trim().toLowerCase();
        if (q && !item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) return false;
        return true;
    });

    return (
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Locations Master</h1>

            <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
                <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit' : 'Add'} Locations</h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                        <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required={true} />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Code</label>
                        <input type="text" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required={true} />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Level</label>
                        <select aria-label="Level" value={formData.locationType || ''}
                            onChange={e => setFormData({...formData, locationType: e.target.value, ulbType: '', parentLocationId: ''})}
                            className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required>
                            <option value="">Select level</option>
                            <option value="Ulb">Urban Local Body</option>
                            <option value="Zone">Zone</option>
                            <option value="Ward">Ward</option>
                        </select>
                    </div>

                    {formData.locationType === 'Ulb' && (
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-semibold text-slate-700 mb-1">ULB Type</label>
                            <select aria-label="ULB Type" value={formData.ulbType || ''}
                                onChange={e => setFormData({...formData, ulbType: e.target.value})}
                                className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required>
                                <option value="">Select ULB type</option>
                                {ULB_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                        </div>
                    )}

                    {(formData.locationType === 'Zone' || formData.locationType === 'Ward') && (
                        <div className="flex-1 min-w-[240px]">
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Parent</label>
                            <select aria-label="Parent" value={formData.parentLocationId || ''}
                                onChange={e => setFormData({...formData, parentLocationId: e.target.value})}
                                className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required>
                                <option value="">Select parent</option>
                                {data
                                    .filter(l => formData.locationType === 'Zone'
                                        ? l.locationType === 'Ulb'
                                        : l.locationType === 'Ulb' || l.locationType === 'Zone')
                                    .map(l => <option key={l.id} value={l.id}>{l.name} ({l.locationType})</option>)}
                            </select>
                        </div>
                    )}
                    <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
                        {isEditing ? 'Update' : 'Save'}
                    </button>
                    {isEditing && (
                        <button type="button" onClick={() => { setIsEditing(false); setFormData(emptyForm); }} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
                            Cancel
                        </button>
                    )}
                </form>
            </div>

            {(loadError || saveError) && (
                <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 flex items-start justify-between gap-4">
                    <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
                    {loadError && (
                        <button type="button" onClick={fetchData} className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800">Retry</button>
                    )}
                </div>
            )}

            <div className="bg-white p-4 rounded-card shadow-sm border border-slate-200 mb-4 flex flex-wrap items-end gap-4">
                <div className="min-w-[200px]">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Level</label>
                    <select aria-label="Filter by level" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
                        className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none">
                        <option value="">All levels</option>
                        <option value="Ulb">Urban Local Body</option>
                        <option value="Zone">Zone</option>
                        <option value="Ward">Ward</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Search</label>
                    <input type="text" placeholder="Search by name or code" value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </div>
                <p className="text-sm text-slate-600 pb-2">Showing {filteredData.length} of {data.length}</p>
            </div>

            <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Level</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Parent</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{item.code}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {item.locationType}{item.ulbType ? ` · ${item.ulbType}` : ''}
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    {item.parentLocationId ? nameById.get(item.parentLocationId) ?? '—' : '—'}
                                </td>
                                <td className="px-6 py-4 text-right space-x-3">
                                    <button onClick={() => handleEdit(item)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-700 hover:text-red-700 font-bold underline text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
                {!loading && !loadError && data.length === 0 && <div className="p-10 text-center text-slate-600">No records found.</div>}
                {!loading && !loadError && data.length > 0 && filteredData.length === 0 && <div className="p-10 text-center text-slate-600">No locations match the current filter.</div>}
            </div>
        </div>
    );
};

export default LocationMaster;
