import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { LocationCascade, type LocationValue } from '../../components/LocationCascade';

interface Tender {
    id: string;
    tenderNo: string;
    title: string;
    tenderType: string;
    budget: number;
    status: string;
    createdAt: string;
}

const TenderList: React.FC = () => {
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [locationFilter, setLocationFilter] = useState<LocationValue>({ ulbId: '', zoneId: '', wardId: '' });
    const navigate = useNavigate();

    // Location narrows server-side (the ids are indexed columns on Tender), unlike search and
    // type which filter the fetched page client-side.
    const fetchTenders = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axiosInstance.get('/tenders', {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    ...(locationFilter.ulbId && { ulbId: locationFilter.ulbId }),
                    ...(locationFilter.zoneId && { zoneId: locationFilter.zoneId }),
                    ...(locationFilter.wardId && { wardId: locationFilter.wardId }),
                },
            });
            setTenders(res.data);
        } catch (err) {
            console.error('Failed to fetch tenders', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationFilter]);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this tender? This will also affect any work orders linked to it.')) return;
        try {
            const token = localStorage.getItem('token');
            await axiosInstance.delete(`/tenders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTenders();
        } catch {
            alert('Failed to delete tender');
        }
    };

    if (loading) return <div className="text-center">Loading tenders...</div>;

    const filteredTenders = tenders.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                              t.tenderNo.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType ? t.tenderType === filterType : true;
        return matchesSearch && matchesType;
    });

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tender Directory</h1>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="Search by ID or Title" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border border-slate-300 rounded-control px-4 py-2 w-64 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    <select aria-label="Select an option" 
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                        <option value="">All Types</option>
                        <option value="Open">Open</option>
                        <option value="Limited">Limited</option>
                        <option value="Single Source">Single Source</option>
                        <option value="GeM">GeM</option>
                    </select>
                    <button
                        onClick={() => navigate('/admin/masters/tenders/add')}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-card font-bold shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-2"
                    >
                        <Plus size={18} /> Create New Tender
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-card border border-slate-200 mb-6">
                <div className="flex items-end gap-3 flex-wrap">
                    <LocationCascade value={locationFilter} onChange={setLocationFilter} inline />
                    {(locationFilter.ulbId || locationFilter.wardId) && (
                        <button type="button"
                            onClick={() => setLocationFilter({ ulbId: '', zoneId: '', wardId: '' })}
                            className="px-4 py-2 rounded-control font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Tender ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Budget</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {[...filteredTenders].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map((t) => (
                            <tr key={t.id} className="hover:bg-brand-50/30 transition-colors">
                                <td className="px-6 py-4 font-mono text-sm font-semibold text-brand-700">{t.tenderNo}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{t.title}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{t.tenderType}</span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">₹{t.budget.toLocaleString('en-IN')}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
                                        t.status === 'Awarded' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                                    }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-4 whitespace-nowrap">
                                    <button 
                                        aria-label="Edit Tender"
                                        onClick={() => navigate(`/admin/masters/tenders/edit/${t.id}`)}
                                        className="text-brand-600 hover:text-brand-800 text-sm font-bold inline-flex items-center gap-1.5"
                                    >
                                        <Edit2 size={16} /> Edit
                                    </button>
                                    <button 
                                        aria-label="Delete Tender"
                                        onClick={() => handleDelete(t.id)}
                                        className="text-red-700 hover:text-red-700 text-sm font-bold inline-flex items-center gap-1.5"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {filteredTenders.length === 0 && (
                    <div className="p-20 text-center text-slate-600 font-medium">
                        No tenders found matching your criteria.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TenderList;
