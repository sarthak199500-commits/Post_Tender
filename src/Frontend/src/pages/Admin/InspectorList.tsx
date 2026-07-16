import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

interface Inspector {
    id: string;
    name: string;
    email: string;
    mobile: string;
    type: string;
    companyName?: string;
    createdAt: string;
}

const InspectorList: React.FC = () => {
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchInspectors = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axiosInstance.get('/inspectors', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInspectors(res.data);
        } catch (err) {
            console.error('Failed to fetch inspectors', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInspectors();
    }, []);

    if (loading) return <div className="p-10 text-center text-slate-600">Loading inspectors...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Inspector Directory</h1>
                    <p className="text-slate-600 mt-1 text-sm font-medium">Manage departmental and 3rd-party inspectors.</p>
                </div>
                <button
                    onClick={() => navigate('/admin/masters/inspectors/add')}
                    className="bg-blue-700 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95"
                >
                    + Add Inspector
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Inspector Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Email / Mobile</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Affiliation</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {inspectors.map((i) => (
                            <tr key={i.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{i.name}</div>
                                    <div className="text-[10px] text-slate-600 font-mono">ID: {i.id.substring(0, 8)}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-slate-600 font-medium">{i.email}</div>
                                    <div className="text-xs text-slate-600">{i.mobile}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest ${
                                        i.type === 'Department' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {i.type}
                                    </span>
                                    {i.companyName && (
                                        <div className="text-[10px] text-slate-600 mt-1 italic">{i.companyName}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-600 hover:text-slate-600 font-bold text-sm underline">
                                        View History
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {inspectors.length === 0 && (
                    <div className="p-20 text-center text-slate-600 font-medium">
                        No inspectors registered yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectorList;
