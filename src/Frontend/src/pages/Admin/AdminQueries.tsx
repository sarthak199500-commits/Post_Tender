import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { MessageSquare, Send, Clock, Search, CheckCircle2, User } from 'lucide-react';
import type { RootState } from '../../store';

export const AdminQueries = () => {
  const [queries, setQueries] = useState<any[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { token } = useSelector((state: RootState) => state.auth);

  const loadQueries = () => {
    fetch('http://localhost:5249/api/queries', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        setQueries(data);
        if (selectedQuery) {
            const updated = data.find((q: any) => q.id === selectedQuery.id);
            if (updated) setSelectedQuery(updated);
        }
    })
    .catch(console.error);
  };

  useEffect(() => {
    loadQueries();
  }, [token]);

  const handleSendMessage = async () => {
    if (!selectedQuery || !newMessage.trim()) return;

    try {
        const res = await fetch(`http://localhost:5249/api/queries/${selectedQuery.id}/message`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ content: newMessage })
        });
        if (res.ok) {
            setNewMessage('');
            loadQueries();
        }
    } catch (e) { console.error(e); }
  };

  const filteredQueries = queries.filter(q => 
    q.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.vendorId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
            Vendor Queries & Support
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Manage and respond to technical and administrative queries raised by vendors.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
           {/* Sidebar: Query List */}
           <div className="w-full md:w-96 space-y-4">
              <div className="relative">
                 <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
                 <input 
                   type="text" 
                   placeholder="Search subject or vendor..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                 />
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">Inbox</div>
                  <div className="overflow-y-auto flex-1">
                      {filteredQueries.map(q => (
                        <div 
                          key={q.id} 
                          onClick={() => setSelectedQuery(q)}
                          className={`p-4 border-b border-slate-100 transition-all cursor-pointer ${selectedQuery?.id === q.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                    q.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 
                                    q.status === 'Open' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {q.status}
                                </span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">{new Date(q.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-800 line-clamp-2">{q.subject}</h3>
                            <p className="text-xs text-slate-600 font-medium mt-1">Vendor: {q.vendorId.substring(0,8)}...</p>
                        </div>
                      ))}
                      {filteredQueries.length === 0 && (
                          <div className="p-8 text-center text-slate-600 text-sm font-medium">No queries found.</div>
                      )}
                  </div>
              </div>
           </div>

           {/* Main Chat Area */}
           <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[660px] overflow-hidden">
              {selectedQuery ? (
                  <>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg">{selectedQuery.subject}</h2>
                            <p className="text-xs text-slate-600 font-bold mt-1">Vendor ID: {selectedQuery.vendorId}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                             selectedQuery.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 
                             selectedQuery.status === 'Open' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                             {selectedQuery.status}
                        </span>
                    </div>

                    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                        {selectedQuery.messages?.map((msg: any) => (
                            <div key={msg.id} className={`flex gap-4 max-w-xl ${msg.senderRole === 'Vendor' ? '' : 'ml-auto flex-row-reverse'}`}>
                                <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${msg.senderRole === 'Vendor' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white shadow-md'}`}>
                                    {msg.senderRole === 'Vendor' ? 'V' : 'PMU'}
                                </div>
                                <div className={`p-4 rounded-2xl shadow-sm border ${msg.senderRole === 'Vendor' ? 'bg-white border-slate-200 rounded-tl-none text-slate-800' : 'bg-indigo-50 border-indigo-100 rounded-tr-none text-indigo-900'}`}>
                                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.content}</p>
                                    <p className={`text-[10px] mt-3 font-black uppercase tracking-wider ${msg.senderRole === 'Vendor' ? 'text-slate-600' : 'text-indigo-400'}`}>
                                        {msg.senderName} • {new Date(msg.timestamp).toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50">
                        <div className="relative">
                            <textarea 
                                rows={3}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="w-full p-4 pr-16 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white shadow-inner font-medium resize-none"
                                placeholder="Write your response to the vendor..."
                            />
                            <button 
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim()}
                                className="absolute right-3 bottom-3 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md disabled:"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                      <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                          <MessageSquare className="w-10 h-10" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-700">Inbox Empty</h2>
                      <p className="text-slate-600 mt-2 font-medium">Select a query from the left panel to read and respond.</p>
                  </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
