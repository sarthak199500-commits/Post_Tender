import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import { AmountInput } from '../../components/AmountInput';
import { LocationCascade } from '../../components/LocationCascade';

const PORTALS = ['GeM Portal', 'CPPP', 'eProcurement', 'NIC Tender', 'State Portal', 'Other'];

interface TenderRecord {
  id: string;
  tenderNo: string;
  title: string;
  description: string;
  tenderType: string;
  budget: number;
  emdAmount: number;
  portal: string;
  publishDate?: string;
  closeDate?: string;
  departmentId?: string | null;
  ulbId?: string | null;
  zoneId?: string | null;
  wardId?: string | null;
}

export const AddTender = () => {
  const { id } = useParams();
  const [formData, setFormData] = useState({
    tenderNo: '',
    title: '',
    description: '',
    tenderType: '',
    budget: '',
    emdAmount: '',
    portal: '',
    publishDate: '',
    closeDate: '',
    departmentId: '',
    ulbId: '', zoneId: '', wardId: '',
  });
  const [document, setDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tenderTypes, setTenderTypes] = useState<{id: string, name: string}[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTenderTypes = async () => {
      try {
        const res = await axiosInstance.get('/tendertypes');
        setTenderTypes(res.data);
      } catch (err) {
        console.error('Failed to fetch tender types', err);
      }
    };
    fetchTenderTypes();

    // Departments are mastered in IdentityService; the tender stores only the id.
    axiosInstance.get<{id: string, name: string, isActive?: boolean}[]>('/masters/departments')
      .then(res => setDepartments((res.data ?? []).filter(d => d.isActive !== false)))
      .catch(err => console.error('Failed to fetch departments', err));

    if (id) {
      const fetchTender = async () => {
        try {
          const res = await axiosInstance.get<TenderRecord[]>('/tenders');
          const tender = res.data.find(t => t.id === id);
          if (tender) {
            setFormData({
              tenderNo: tender.tenderNo,
              title: tender.title,
              description: tender.description,
              tenderType: tender.tenderType,
              budget: tender.budget.toString(),
              emdAmount: tender.emdAmount.toString(),
              portal: tender.portal,
              publishDate: tender.publishDate ? tender.publishDate.split('T')[0] : '',
              closeDate: tender.closeDate ? tender.closeDate.split('T')[0] : '',
              departmentId: tender.departmentId ?? '',
              ulbId: tender.ulbId ?? '',
              zoneId: tender.zoneId ?? '',
              wardId: tender.wardId ?? '',
            });
          }
        } catch (err) {
          console.error('Failed to fetch tender for editing', err);
        }
      };
      fetchTender();
    }
  }, [id]);

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const data = new FormData();
    data.append('tenderNo', formData.tenderNo);
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('tenderType', formData.tenderType);
    data.append('budget', formData.budget);
    data.append('emdAmount', formData.emdAmount);
    data.append('portal', formData.portal);
    if (formData.publishDate) data.append('publishDate', formData.publishDate);
    if (formData.closeDate)   data.append('closeDate', formData.closeDate);
    if (formData.departmentId) data.append('departmentId', formData.departmentId);
    // Only send what was chosen. Zone is legitimately blank for a ULB with no zones, and an
    // empty string would fail Guid binding server-side.
    if (formData.ulbId) data.append('ulbId', formData.ulbId);
    if (formData.zoneId) data.append('zoneId', formData.zoneId);
    if (formData.wardId) data.append('wardId', formData.wardId);
    if (document)             data.append('document', document);

    try {
      const url = id ? `/tenders/${id}` : '/tenders';
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (id) {
        await axiosInstance.put(url, data, config);
      } else {
        await axiosInstance.post(url, data, config);
      }

      setSuccess(true);
      setTimeout(() => navigate('/admin/masters/tenders'), 1500);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        setError(typeof err.response.data === 'string' ? err.response.data : 'Failed to save tender');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save tender');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full p-3 border border-slate-300 rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white text-slate-800';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-2';

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/admin/tenders/awarded')}
        className="text-brand-700 font-bold text-sm hover:underline mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to List
      </button>
      <h2 className="text-3xl font-bold text-slate-800 mb-8">{id ? 'Edit Tender' : 'Add Tender'}</h2>

      <div className="bg-white p-8 rounded-card shadow-xl border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Row 1: Tender ID + Name */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Tender ID</label>
              <input type="text" className={inputCls} placeholder="e.g. TND/2024/102"
                value={formData.tenderNo} onChange={e => set('tenderNo', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Tender Name</label>
              <input type="text" className={inputCls} placeholder="Short name of the project"
                value={formData.title} onChange={e => set('title', e.target.value)} required />
            </div>
          </div>

          {/* Row 2: Type + Portal */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Tender Type</label>
              <select aria-label="Select an option" className={inputCls} value={formData.tenderType}
                onChange={e => set('tenderType', e.target.value)} required>
                <option value="">Select Type</option>
                {tenderTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <select aria-label="Select an option" className={inputCls} value={formData.departmentId}
                onChange={e => set('departmentId', e.target.value)}>
                <option value="">Unassigned</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <LocationCascade
                value={{
                  ulbId: formData.ulbId ?? '',
                  zoneId: formData.zoneId ?? '',
                  wardId: formData.wardId ?? '',
                }}
                onChange={(next) => setFormData({ ...formData, ...next })}
              />
            </div>
            <div>
              <label className={labelCls}>Uploaded On (Portal)</label>
              <select aria-label="Select an option" className={inputCls} value={formData.portal}
                onChange={e => set('portal', e.target.value)} required>
                <option value="">Select Portal</option>
                {PORTALS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Budget + EMD */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Budget (₹)</label>
              <AmountInput className={inputCls} placeholder="e.g. 1,20,00,000"
                value={formData.budget} onValueChange={v => set('budget', v)} required />
            </div>
            <div>
              <label className={labelCls}>EMD Amount (₹)</label>
              <AmountInput className={inputCls} placeholder="e.g. 2,00,000"
                value={formData.emdAmount} onValueChange={v => set('emdAmount', v)} required />
            </div>
          </div>

          {/* Row 4: Publish Date + Close Date */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Publish Date</label>
              <input type="date" className={inputCls}
                value={formData.publishDate} onChange={e => set('publishDate', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Close Date</label>
              <input type="date" className={inputCls}
                value={formData.closeDate} onChange={e => set('closeDate', e.target.value)} required />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} h-28`} placeholder="Scope of work, project details..."
              value={formData.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Document Upload */}
          <div>
            <label className={labelCls}>Tender Document</label>
            <div className="border-2 border-dashed border-slate-300 rounded-card p-5 text-center hover:border-brand-400 transition-colors">
              <input
                type="file"
                id="tenderDoc"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={e => setDocument(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="tenderDoc" className="cursor-pointer flex flex-col items-center gap-2">
                <span className="text-3xl">📎</span>
                {document ? (
                  <span className="text-brand-700 font-medium">{document.name}</span>
                ) : (
                  <span className="text-slate-600 text-sm">Click to upload PDF, Word or Excel file</span>
                )}
              </label>
            </div>
          </div>

          {error   && <p className="text-red-700 text-sm">{error}</p>}
          {success && <p className="text-emerald-700 text-sm font-medium">Tender created successfully!</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-card shadow-lg transition-transform active:scale-95 disabled:"
          >
            {loading ? 'Saving...' : 'Save Tender'}
          </button>
        </form>
      </div>
    </div>
  );
};
