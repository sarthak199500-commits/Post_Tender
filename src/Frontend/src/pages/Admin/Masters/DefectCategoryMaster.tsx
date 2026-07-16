import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance';

interface DefectCategory {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: string;
}

const DefectCategoryMaster: React.FC = () => {
    const [data, setData] = useState<DefectCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<Partial<DefectCategory>>({"name":"","description":""});
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState('');

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axiosInstance.get('/masters/defectcategories', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            if (isEditing) {
                await axiosInstance.put(`/masters/defectcategories/${editId}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axiosInstance.post('/masters/defectcategories', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setFormData({"name":"","description":""});
            setIsEditing(false);
            setEditId('');
            fetchData();
        } catch (err) {
            alert('Failed to save');
        }
    };

    const handleEdit = (item: DefectCategory) => {
        setFormData(item);
        setIsEditing(true);
        setEditId(item.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            const token = localStorage.getItem('token');
            await axiosInstance.delete(`/masters/defectcategories/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Defect Categories Master</h1>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit' : 'Add'} Defect Categories</h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Category Name</label>
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Category Name</th>
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
                </table>
                {!loading && data.length === 0 && <div className="p-10 text-center text-slate-600">No records found.</div>}
            </div>
        </div>
    );
};

export default DefectCategoryMaster;
