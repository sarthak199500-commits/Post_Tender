import { useEffect, useState } from 'react';
import { Search, File, Download, Folder, Filter } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

interface ContractDocument {
  id: string;
  vendorId: string;
  name: string;
  type: string;
  size: string;
  url: string;
  uploadedAt: string;
  status: string;
}

export const AdminDocuments = () => {
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    axiosInstance.get<ContractDocument[]>('/documents')
      .then(({ data }) => setDocuments(data))
      .catch(err => {
        console.error(err);
        setError('Failed to load documents.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (url: string, name: string) => {
    try {
      const path = url.replace(/^\/api/, '');   // baseURL already ends in /api
      const res = await axiosInstance.get(path, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) { console.error(e); alert('Failed to download document.'); }
  };

  if (loading) return <div className="p-12 text-slate-600 font-bold text-center">Loading documents...</div>;
  if (error) return <div className="p-12 text-red-700 font-bold text-center">Error: {error}</div>;

  const filteredDocs = documents.filter(doc =>
    (doc.type ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <Folder className="w-8 h-8 text-indigo-600" />
            Document Repository
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Centralized view of all vendor submissions, contracts, and attachments.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">All Documents</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600" />
              <input 
                type="text" 
                placeholder="Search documents..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100">
                <th className="p-4">Document Details</th>
                <th className="p-4">Type</th>
                <th className="p-4">Vendor ID</th>
                <th className="p-4">Uploaded On</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-600 py-8 font-medium">No documents found.</td></tr>
              ) : (
                filteredDocs.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <File className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{doc.name || doc.url.split('/').pop() || 'Document'}</p>
                          <p className="text-xs text-slate-600">ID: {doc.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                        {doc.type}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-600">{doc.vendorId.substring(0,8)}...</td>
                    <td className="p-4 text-sm text-slate-600">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                        doc.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' :
                        doc.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {doc.status || 'Uploaded'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDownload(doc.url, doc.name)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center gap-2 text-sm font-semibold border border-transparent hover:border-indigo-100">
                        <Download className="w-4 h-4" /> Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
