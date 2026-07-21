import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';

const AddInspector: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        type: 'Department', // 'Department' or '3rd Party'
        companyName: '',
        password: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            await axiosInstance.post('/inspectors', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/admin/masters/inspectors');
        } catch (err) {
            setError((isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data) || 'Failed to add inspector');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg border border-slate-200 mt-10">
            <button
                type="button"
                onClick={() => navigate('/admin/masters/inspectors')}
                className="text-blue-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1"
            >
                &larr; Back to Directory
            </button>
            <h1 className="text-xl font-semibold text-slate-800 mb-6">Add New Inspector</h1>
            
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Full Name</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        placeholder="Enter inspector name"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            placeholder="email@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Mobile</label>
                        <input
                            type="tel"
                            name="mobile"
                            value={formData.mobile}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            placeholder="+91 XXXXX XXXXX"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Affiliation Type</label>
                    <select aria-label="Select an option"
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all bg-white"
                    >
                        <option value="Department">Department</option>
                        <option value="3rd Party">3rd Party</option>
                    </select>
                </div>

                {formData.type === '3rd Party' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Company Name</label>
                        <input
                            type="text"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleChange}
                            required={formData.type === '3rd Party'}
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            placeholder="Enter 3rd party company name"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">Account Password</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        placeholder="••••••••"
                    />
                    <p className="text-xs text-slate-500 mt-2 ml-1">This will be used for their individual dashboard login.</p>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-blue-800 hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-70 flex justify-center items-center"
                    >
                        {loading ? 'Processing...' : 'Register Inspector'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddInspector;
