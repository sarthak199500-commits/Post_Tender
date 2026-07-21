import React, { useState, useEffect } from 'react';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';

interface TenderType {
    id: string;
    name: string;
}

const TenderTypeMaster: React.FC = () => {
    const [types, setTypes] = useState<TenderType[]>([]);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTypes = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axiosInstance.get('/tendertypes', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTypes(res.data);
        } catch (err) {
            console.error('Failed to fetch tender types', err);
        }
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            await axiosInstance.post('/tendertypes', { name: newName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewName('');
            fetchTypes();
        } catch (err) {
            setError((isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data) || 'Failed to add tender type');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            const token = localStorage.getItem('token');
            await axiosInstance.delete(`/tendertypes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTypes();
        } catch {
            alert('Failed to delete');
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-100 mt-10">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Tender Type Master</h1>

            <form onSubmit={handleAdd} className="flex gap-2 mb-8">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter new tender type (e.g. PPP, Hybrid)"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-700 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:"
                >
                    {loading ? 'Adding...' : 'Add Type'}
                </button>
            </form>

            {error && <div className="mb-4 text-red-700 text-sm">{error}</div>}

            <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3 text-sm font-bold text-slate-600 uppercase">Tender Type</th>
                            <th className="px-4 py-3 text-sm font-bold text-slate-600 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {types.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-700 font-medium">{t.name}</td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => handleDelete(t.id)}
                                        className="text-red-700 hover:text-red-700 text-sm font-semibold"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TenderTypeMaster;
