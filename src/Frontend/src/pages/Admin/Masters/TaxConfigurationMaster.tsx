import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance';
import { describeApiError } from '../../../api/apiError';

interface TaxConfiguration {
    id: string;
    taxName: string;
    code: string;
    percentage: number;
    isActive: boolean;
    createdAt: string;
}

const TaxConfigurationMaster: React.FC = () => {
    const [data, setData] = useState<TaxConfiguration[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<TaxConfiguration>>({"taxName":"","code":"","percentage":0});
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState('');

    const fetchData = async () => {
        try {
            const res = await axiosInstance.get('/masters/taxconfigurations');
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
                await axiosInstance.put(`/masters/taxconfigurations/${editId}`, formData);
            } else {
                await axiosInstance.post('/masters/taxconfigurations', formData);
            }
            setFormData({"taxName":"","code":"","percentage":0});
            setIsEditing(false);
            setEditId('');
            fetchData();
        } catch (err) {
            setSaveError(describeApiError(err, 'Failed to save'));
        }
    };

    const handleEdit = (item: TaxConfiguration) => {
        setFormData(item);
        setIsEditing(true);
        setEditId(item.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await axiosInstance.delete(`/masters/taxconfigurations/${id}`);
            fetchData();
        } catch (err) {
            setSaveError(describeApiError(err, 'Failed to delete'));
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Tax Configurations Master</h1>
            
            <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
                <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit' : 'Add'} Tax Configurations</h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tax Name</label>
                        <input type="text" value={formData.taxName || ''} onChange={e => setFormData({...formData, taxName: e.target.value})} className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required={true} />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Code</label>
                        <input type="text" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required={true} />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Percentage (%)</label>
                        <input type="number" value={formData.percentage || ''} onChange={e => setFormData({...formData, percentage: Number(e.target.value)})} className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required={true} />
                    </div>
                    <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
                        {isEditing ? 'Update' : 'Save'}
                    </button>
                    {isEditing && (
                        <button type="button" onClick={() => { setIsEditing(false); setFormData({"taxName":"","code":"","percentage":0}); }} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
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

            <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Tax Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Percentage (%)</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-800">{item.taxName}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{item.code}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{item.percentage}</td>
                                <td className="px-6 py-4 text-right space-x-3">
                                    <button onClick={() => handleEdit(item)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                                    <button onClick={() => handleDelete(item.id)} className="text-red-700 hover:text-red-700 font-bold underline text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
                {!loading && !loadError && data.length === 0 && <div className="p-10 text-center text-slate-600">No records found.</div>}
            </div>
        </div>
    );
};

export default TaxConfigurationMaster;
