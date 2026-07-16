import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  FolderOpen, 
  Upload, 
  File, 
  Trash2, 
  CheckCircle,
  FileText,
  Shield,
  Briefcase,
  Clock
} from 'lucide-react';
import type { RootState } from '../../store';

const API_BASE = 'http://localhost:5249';

export const DocumentUploads = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [isUploading, setIsUploading] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);

  const loadDocs = () => {
    fetch(`${API_BASE}/api/documents`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(setDocs)
    .catch(console.error);
  };

  useEffect(() => {
    loadDocs();
  }, [token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        
        // Save metadata to database
        const docMeta = {
            name: data.name,
            type: 'General',
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            url: data.url
        };

        await fetch(`${API_BASE}/api/documents`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(docMeta)
        });

        loadDocs();
        alert("Document uploaded and recorded successfully!");
      }
    } catch (e) { console.error(e); }
    finally { setIsUploading(false); }
  };

  const handleDelete = async (id: string, url: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
        // Delete from database
        await fetch(`${API_BASE}/api/documents/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });

        // Delete from file system
        await fetch(`${API_BASE}/api/files?url=${url}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });

        loadDocs();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-amber-600" />
              Document Repository
            </h1>
            <p className="text-slate-600 mt-2">Manage your contractual documents, insurances, and compliance certificates.</p>
          </div>
          <label className="bg-amber-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 cursor-pointer">
            <Upload className="w-5 h-5" />
            {isUploading ? 'Uploading...' : 'Upload New Document'}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                 <Briefcase className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Financial Docs</p>
                 <p className="text-xl font-black text-slate-800">{docs.filter(d => d.type === 'Financial').length} Files</p>
              </div>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                 <Shield className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Compliance</p>
                 <p className="text-xl font-black text-slate-800">{docs.filter(d => d.type === 'Compliance').length} Files</p>
              </div>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 text-amber-600">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                 <Clock className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Awaiting Verification</p>
                 <p className="text-xl font-black">{docs.filter(d => d.status === 'Pending').length} Files</p>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Active Documents</h2>
           </div>
           <div className="divide-y divide-slate-100">
              {docs.map(doc => (
                <div key={doc.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/30 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 rounded-xl">
                         <FileText className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                         <p className="font-bold text-slate-800">{doc.name}</p>
                         <p className="text-xs text-slate-600 font-medium">{doc.type} • {doc.size} • Uploaded on {doc.date}</p>
                      </div>
                   </div>
                    <div className="flex items-center gap-4">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                         doc.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                       }`}>
                          {doc.status}
                       </span>
                       <div className="flex gap-2">
                          <a 
                            href={`${API_BASE}${doc.url}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                             <Upload className="w-4 h-4 rotate-180" />
                          </a>
                          <button 
                            onClick={() => handleDelete(doc.id, doc.url)}
                            className="p-2 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};
