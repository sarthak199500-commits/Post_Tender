import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';

interface TenderAllotment {
    id: string;
    tenderId: string;
    tenderNo: string;
    tenderTitle: string;
    l1VendorId: string;
    l1VendorName: string;
}

interface Inspector {
    id: string;
    name: string;
    type: string;
    companyName?: string;
}

interface Milestone {
    title: string;
    weightage: number;
    paymentPercentage: number;
    targetDate: string;
}

const IssueWorkOrder: React.FC = () => {
    const navigate = useNavigate();
    const [allotments, setAllotments] = useState<TenderAllotment[]>([]);
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        tenderId: '',
        vendorId: '', // Auto-filled from L1
        vendorName: '',
        workOrderNo: '',
        totalValue: 0,
        scopeDescription: '',
        paymentTerms: '',
        startDate: '',
        endDate: '',
        liquidatedDamagesTerms: '',
        agreementDocumentUrl: '',
        inspectorId: '',
    });

    const [milestones, setMilestones] = useState<Milestone[]>([
        { title: '', weightage: 0, paymentPercentage: 0, targetDate: '' }
    ]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const [allotRes, inspRes] = await Promise.all([
                    axiosInstance.get('/tenderallotments', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axiosInstance.get('/inspectors', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);
                setAllotments(allotRes.data);
                setInspectors(inspRes.data);
            } catch (err) {
                console.error('Failed to fetch data', err);
            }
        };
        fetchData();
    }, []);

    const handleTenderChange = (tenderId: string) => {
        const allotment = allotments.find(a => a.tenderId === tenderId);
        if (allotment) {
            setFormData(prev => ({
                ...prev,
                tenderId: allotment.tenderId,
                vendorId: allotment.l1VendorId,
                vendorName: allotment.l1VendorName
            }));
        } else {
            setFormData(prev => ({ ...prev, tenderId: '', vendorId: '', vendorName: '' }));
        }
    };

    const handleMilestoneChange = (index: number, field: keyof Milestone, value: string | number) => {
        const newMilestones = [...milestones];
        newMilestones[index] = { ...newMilestones[index], [field]: value };
        setMilestones(newMilestones);
    };

    const addMilestone = () => {
        setMilestones([...milestones, { title: '', weightage: 0, paymentPercentage: 0, targetDate: '' }]);
    };

    const removeMilestone = (index: number) => {
        setMilestones(milestones.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const totalWeightage = milestones.reduce((sum, m) => sum + Number(m.weightage), 0);
        if (totalWeightage !== 100) {
            setError('Sum of Milestone Weightages must be exactly 100%');
            setLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const payload = {
                ...formData,
                totalValue: Number(formData.totalValue),
                milestones: milestones.map(m => ({
                    ...m,
                    weightage: Number(m.weightage),
                    paymentPercentage: Number(m.paymentPercentage)
                }))
            };

            await axiosInstance.post('/workorders', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/admin/work-orders');
        } catch (err) {
            setError((isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data) || 'Failed to issue work order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-sm border border-slate-100 my-10">
            <h1 className="text-3xl font-bold text-slate-900 mb-8">Issue Work Order</h1>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Tender & Vendor Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-xl">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Tender</label>
                        <select aria-label="Select an option"
                            value={formData.tenderId}
                            onChange={(e) => handleTenderChange(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">-- Select Tender --</option>
                            {allotments.map(a => (
                                <option key={a.id} value={a.tenderId}>{a.tenderTitle} ({a.tenderNo})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Selected Vendor (L1)</label>
                        <input
                            type="text"
                            value={formData.vendorName}
                            readOnly
                            placeholder="Select tender to auto-fill"
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed outline-none"
                        />
                    </div>
                </div>

                {/* Work Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Work ID / WO No.</label>
                        <input
                            type="text"
                            value={formData.workOrderNo}
                            onChange={(e) => setFormData({ ...formData, workOrderNo: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. WO-2024-001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Project Cost (Total Value)</label>
                        <input
                            type="number"
                            value={formData.totalValue}
                            onChange={(e) => setFormData({ ...formData, totalValue: Number(e.target.value) })}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
                        <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
                        <input
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                {/* Inspector Selection */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Assign Inspector</label>
                    <select aria-label="Select an option"
                        value={formData.inspectorId}
                        onChange={(e) => setFormData({ ...formData, inspectorId: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">-- Select Inspector --</option>
                        {inspectors.map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.type === '3rd Party' ? i.companyName : 'Dept'})</option>
                        ))}
                    </select>
                </div>

                {/* Terms */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Scope of Work</label>
                    <textarea
                        value={formData.scopeDescription}
                        onChange={(e) => setFormData({ ...formData, scopeDescription: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                        placeholder="Detailed description of work..."
                    />
                </div>

                {/* Milestones */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Project Milestones</h2>
                        <button
                            type="button"
                            onClick={addMilestone}
                            className="text-blue-700 hover:text-blue-700 font-semibold text-sm"
                        >
                            + Add Milestone
                        </button>
                    </div>
                    <div className="space-y-4">
                        {milestones.map((m, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-slate-100 rounded-xl relative group">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-600 uppercase">Title</label>
                                    <input
                                        type="text"
                                        value={m.title}
                                        onChange={(e) => handleMilestoneChange(index, 'title', e.target.value)}
                                        required
                                        className="w-full px-3 py-1 border-b border-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Weightage %</label>
                                    <input
                                        type="number"
                                        value={m.weightage}
                                        onChange={(e) => handleMilestoneChange(index, 'weightage', Number(e.target.value))}
                                        required
                                        className="w-full px-3 py-1 border-b border-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase">Payment %</label>
                                    <input
                                        type="number"
                                        value={m.paymentPercentage}
                                        onChange={(e) => handleMilestoneChange(index, 'paymentPercentage', Number(e.target.value))}
                                        required
                                        className="w-full px-3 py-1 border-b border-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-600 uppercase">Target Date</label>
                                    <input
                                        type="date"
                                        value={m.targetDate}
                                        onChange={(e) => handleMilestoneChange(index, 'targetDate', e.target.value)}
                                        required
                                        className="w-full px-3 py-1 border-b border-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                {milestones.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeMilestone(index)}
                                        className="absolute -right-2 -top-2 bg-white border border-red-200 text-red-700 rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-6">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:"
                    >
                        {loading ? 'Processing...' : 'Issue Official Work Order'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default IssueWorkOrder;
