import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { describeApiError } from '../../api/apiError';

interface TenderType {
    id: string;
    name: string;
}

const TenderTypeMaster: React.FC = () => {
    const [types, setTypes] = useState<TenderType[]>([]);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // The Authorization header is attached by the axiosInstance interceptor, which reads
    // whichever store holds the session. Passing it per-call from localStorage broke the
    // moment "Remember Me" was unchecked.
    const fetchTypes = async () => {
        try {
            const res = await axiosInstance.get<TenderType[]>('/tendertypes');
            setTypes(res.data);
            setLoadError(null);
        } catch (err) {
            // Swallowing this is what made a stopped service look like an empty master.
            console.error('Failed to fetch tender types', err);
            setTypes([]);
            setLoadError(describeApiError(err, 'Could not load tender types'));
        } finally {
            setLoaded(true);
        }
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;

        // Master data: reject a duplicate here rather than let the table collect two
        // rows that render identically and cannot be told apart afterwards.
        if (types.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) {
            setError(`"${name}" already exists.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await axiosInstance.post('/tendertypes', { name });
            setNewName('');
            await fetchTypes();
        } catch (err) {
            setError(describeApiError(err, 'Failed to add tender type'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        setError(null);
        try {
            await axiosInstance.delete(`/tendertypes/${id}`);
            await fetchTypes();
        } catch (err) {
            setError(describeApiError(err, 'Failed to delete tender type'));
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-card shadow-sm border border-slate-100 mt-10">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Tender Type Master</h1>

            <form onSubmit={handleAdd} className="flex gap-2 mb-8">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter new tender type (e.g. PPP, Hybrid)"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-control focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-control font-semibold transition-colors disabled:"
                >
                    {loading ? 'Adding...' : 'Add Type'}
                </button>
            </form>

            {/* One banner, not two: when the service is down the add and the reload fail
                for the same reason and produced the identical sentence twice. */}
            {(error || loadError) && (
                <div className="mb-4 p-4 rounded-control bg-red-50 border border-red-200 flex items-start justify-between gap-4">
                    <p className="text-sm text-red-700 font-medium">{error || loadError}</p>
                    {loadError && (
                        <button
                            type="button"
                            onClick={fetchTypes}
                            className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            <div className="border border-slate-100 rounded-control overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full text-left">
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
                </table></div>
                {/* An unreachable service can take several seconds to fail, so say we are
                    still loading rather than render a bare table in the meantime. */}
                {!loaded && <div className="p-8 text-center text-slate-600 text-sm">Loading tender types…</div>}
                {loaded && !loadError && types.length === 0 && (
                    <div className="p-8 text-center text-slate-600 text-sm">No tender types defined yet.</div>
                )}
            </div>
        </div>
    );
};

export default TenderTypeMaster;
