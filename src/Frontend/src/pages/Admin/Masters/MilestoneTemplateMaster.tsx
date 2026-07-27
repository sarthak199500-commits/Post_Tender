import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance';
import { describeApiError } from '../../../api/apiError';

interface MilestoneTemplate {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: string;
}

const MilestoneTemplateMaster: React.FC = () => {
    const [data, setData] = useState<MilestoneTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<MilestoneTemplate>>({"name":"","description":""});
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState('');

    const fetchData = async () => {
        try {
            const res = await axiosInstance.get('/masters/milestonetemplates');
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
                await axiosInstance.put(`/masters/milestonetemplates/${editId}`, formData);
            } else {
                await axiosInstance.post('/masters/milestonetemplates', formData);
            }
            setFormData({"name":"","description":""});
            setIsEditing(false);
            setEditId('');
            fetchData();
        } catch (err) {
            setSaveError(describeApiError(err, 'Failed to save'));
        }
    };

    const handleEdit = (item: MilestoneTemplate) => {
        setFormData(item);
        setIsEditing(true);
        setEditId(item.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await axiosInstance.delete(`/masters/milestonetemplates/${id}`);
            fetchData();
        } catch (err) {
            setSaveError(describeApiError(err, 'Failed to delete'));
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Milestone Templates Master</h1>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit' : 'Add'} Milestone Templates</h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Template Name</label>
                        <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" required={true} />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                        <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" required={false} />
                    </div>
                    <button type="submit" className="bg-blue-700 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold">
                        {isEditing ? 'Update' : 'Save'}
                    </button>
                    {isEditing && (
                        <button type="button" onClick={() => { setIsEditing(false); setFormData({"name":"","description":""}); }} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-lg font-bold">
                            Cancel
                        </button>
                    )}
                </form>
            </div>

            {(loadError || saveError) && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start justify-between gap-4">
                    <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
                    {loadError && (
                        <button type="button" onClick={fetchData} className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800">Retry</button>
                    )}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Template Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{item.description}</td>
                                <td className="px-6 py-4 text-right space-x-3">
                                    <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-800 font-bold underline text-sm">Edit</button>
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

export default MilestoneTemplateMaster;
