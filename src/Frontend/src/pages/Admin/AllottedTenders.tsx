import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import axiosInstance from '../../api/axiosInstance';

interface Tender { id: string; tenderNo: string; title: string; }
interface Vendor { id: string; name: string; vendorCode: string; }
interface Allotment {
  id: string;
  tenderId: string;
  tenderNo: string;
  tenderTitle: string;
  l1VendorId: string | null; l1VendorName: string | null;
  l2VendorId: string | null; l2VendorName: string | null;
  l3VendorId: string | null; l3VendorName: string | null;
  createdAt: string;
}

export const AllottedTenders = () => {
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [form, setForm] = useState({ tenderId: '', l1VendorId: '', l2VendorId: '', l3VendorId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAll = async () => {
    const [tRes, vRes, aRes] = await Promise.allSettled([
      axiosInstance.get<Tender[]>('/tenders'),
      axiosInstance.get<Vendor[]>('/vendors'),
      axiosInstance.get<Allotment[]>('/tenderallotments'),
    ]);
    if (tRes.status === 'fulfilled') setTenders(tRes.value.data); else console.error(tRes.reason);
    if (vRes.status === 'fulfilled') setVendors(vRes.value.data); else console.error(vRes.reason);
    if (aRes.status === 'fulfilled') setAllotments(aRes.value.data); else console.error(aRes.reason);
  };

  useEffect(() => { fetchAll(); }, []);

  // Filter out tenders that already have allotments
  const allottedTenderIds = new Set(allotments.map(a => a.tenderId));
  const availableTenders = tenders.filter(t => !allottedTenderIds.has(t.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');

    if (!form.tenderId) { setError('Please select a tender.'); setLoading(false); return; }
    if (!form.l1VendorId) { setError('L1 vendor is required.'); setLoading(false); return; }

    // The dropdowns already exclude one another, but re-check before saving: the vendor
    // list reloads asynchronously, so a stale selection could still slip through.
    const ranked = [form.l1VendorId, form.l2VendorId, form.l3VendorId].filter(Boolean);
    if (new Set(ranked).size !== ranked.length) {
      setError('L1, L2 and L3 must be three different vendors.');
      setLoading(false);
      return;
    }

    try {
      await axiosInstance.post('/tenderallotments', {
        tenderId: form.tenderId,
        l1VendorId: form.l1VendorId || null,
        l2VendorId: form.l2VendorId || null,
        l3VendorId: form.l3VendorId || null,
      });
      setSuccess('Allotment saved successfully! Redirecting to Awarded Tenders...');
      setTimeout(() => navigate('/admin/tenders/awarded'), 1500);
      setForm({ tenderId: '', l1VendorId: '', l2VendorId: '', l3VendorId: '' });
      fetchAll();
    } catch (err) {
      if (isAxiosError(err) && typeof err.response?.data === 'string' && err.response.data) {
        setError(err.response.data);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save allotment');
      }
    }
    finally { setLoading(false); }
  };



  // L1/L2/L3 are a ranking of distinct bidders, so a vendor picked in one slot must not
  // remain selectable in the others. The slot's own current value stays in its list,
  // otherwise the select would drop the value it is displaying.
  const vendorOptionsFor = (slot: 'l1VendorId' | 'l2VendorId' | 'l3VendorId') => {
    const takenElsewhere = new Set(
      (['l1VendorId', 'l2VendorId', 'l3VendorId'] as const)
        .filter(s => s !== slot)
        .map(s => form[s])
        .filter(Boolean)
    );
    return vendors.filter(v => !takenElsewhere.has(v.id));
  };

  const inputCls = 'w-full p-3 border border-slate-300 rounded-card focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white text-slate-800';
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-2';



  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => window.history.back()}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          title="Go Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2 className="text-3xl font-bold text-slate-800 m-0">Allotted Tenders</h2>
      </div>
      {/* Create form */}
      <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">New Allotment</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelCls}>Select Tender</label>
            <select aria-label="Select an option" className={inputCls} value={form.tenderId} onChange={e => setForm({ ...form, tenderId: e.target.value })} required>
              <option value="">Select a tender</option>
              {availableTenders.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({t.tenderNo})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>L1 (Winner)</label>
              <select aria-label="Select L1 vendor" className={inputCls} value={form.l1VendorId} onChange={e => setForm({ ...form, l1VendorId: e.target.value })} required>
                <option value="">Select L1</option>
                {vendorOptionsFor('l1VendorId').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>L2</label>
              <select aria-label="Select L2 vendor" className={inputCls} value={form.l2VendorId} onChange={e => setForm({ ...form, l2VendorId: e.target.value })}>
                <option value="">Select L2 (optional)</option>
                {vendorOptionsFor('l2VendorId').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>L3</label>
              <select aria-label="Select L3 vendor" className={inputCls} value={form.l3VendorId} onChange={e => setForm({ ...form, l3VendorId: e.target.value })}>
                <option value="">Select L3 (optional)</option>
                {vendorOptionsFor('l3VendorId').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          {error   && <p className="text-red-700 text-sm">{error}</p>}
          {success && <p className="text-emerald-700 text-sm font-medium">{success}</p>}

          <button type="submit" disabled={loading}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3 rounded-card shadow transition-transform active:scale-95 disabled:">
            {loading ? 'Saving...' : 'Save Allotment'}
          </button>
        </form>
      </div>

    </div>
  );
};
