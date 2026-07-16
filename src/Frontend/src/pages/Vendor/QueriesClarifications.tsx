import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  MessageSquare, 
  Send, 
  User, 
  Clock, 
  Search,
  Filter,
  CheckCircle2
} from 'lucide-react';
import type { RootState } from '../../store';

export const QueriesClarifications = () => {
  const [queries, setQueries] = useState<any[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newQuerySubject, setNewQuerySubject] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateQuery = async () => {
      if (!newQuerySubject.trim() || !newMessage.trim()) return;

      try {
          const res = await fetch('http://localhost:5249/api/queries', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify({ 
                  subject: newQuerySubject,
                  messages: [{ content: newMessage }]
              })
          });
          if (res.ok) {
              setNewQuerySubject('');
              setNewMessage('');
              setIsCreating(false);
              loadQueries();
          }
      } catch (e) { console.error(e); }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-indigo-600" />
              Queries & Clarifications
            </h1>
            <p className="text-slate-600 mt-2">Direct communication channel with the PMU team for technical and administrative queries.</p>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Send className="w-5 h-5" />
            Raise New Query
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
           {/* Sidebar: Query List */}
           <div className="w-full md:w-80 space-y-4">
              <div className="relative">
                 <Search className="absolute left-3 top-3 w-4 h-4 text-slate-600" />
                 <input 
                   type="text" 
                   placeholder="Search queries..." 
                   className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
              </div>
              <div className="space-y-2">
                 {queries.map(q => (
                   <div 
                     key={q.id} 
                     onClick={() => setSelectedQuery(q)}
                     className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedQuery?.id === q.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                   >
                      <div className="flex justify-between items-start mb-1">
                         <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider ${
                           q.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 
                           q.status === 'Open' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                         }`}>
                           {q.status}
                         </span>
                         <span className="text-[10px] font-bold text-slate-600 uppercase">{new Date(q.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{q.subject}</h3>
                      {q.messages?.length > 0 && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1 italic">"{q.messages[q.messages.length - 1].content}"</p>
                      )}
                   </div>
                 ))}
                 {queries.length === 0 && (
                     <div className="bg-white p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-600 text-sm">
                         No queries raised yet.
                     </div>
                 )}
              </div>
           </div>

           {/* Main Chat Area */}
           <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[600px]">
              {selectedQuery ? (
                  <>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                                {selectedQuery.subject.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800">{selectedQuery.subject}</h2>
                                <p className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Status: {selectedQuery.status}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-8 space-y-6 overflow-y-auto max-h-[500px]">
                        {selectedQuery.messages?.map((msg: any) => (
                            <div key={msg.id} className={`flex gap-4 max-w-lg ${msg.senderRole === 'Vendor' ? '' : 'ml-auto flex-row-reverse'}`}>
                                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${msg.senderRole === 'Vendor' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>
                                    {msg.senderName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className={`p-4 rounded-2xl ${msg.senderRole === 'Vendor' ? 'bg-slate-100 rounded-tl-none text-slate-800' : 'bg-indigo-600 rounded-tr-none text-white shadow-lg shadow-indigo-100'}`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${msg.senderRole === 'Vendor' ? 'text-slate-600' : 'text-indigo-700'}`}>
                                        {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <textarea 
                                rows={2}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="w-full p-4 pr-16 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                                placeholder="Type your message here..."
                            />
                            <button 
                                onClick={handleSendMessage}
                                className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                  </>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                          <MessageSquare className="w-10 h-10" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-800">Select a Query</h2>
                      <p className="text-slate-600 max-w-xs mt-2">Choose a query from the sidebar to view the conversation or raise a new one.</p>
                  </div>
              )}
           </div>
        </div>
      </div>

      {/* New Query Modal */}
      {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-slate-800">Raise New Query</h2>
                  <button onClick={() => setIsCreating(false)} className="text-slate-600 hover:text-slate-600">×</button>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Subject</label>
                    <input 
                      type="text" 
                      value={newQuerySubject}
                      onChange={(e) => setNewQuerySubject(e.target.value)}
                      placeholder="Enter a brief subject..."
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Message</label>
                    <textarea 
                      rows={4}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Describe your query in detail..."
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
               </div>
               <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
                  <button 
                    onClick={handleCreateQuery}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit Query
                  </button>
               </div>
            </div>
          </div>
      )}
    </div>
  );
};
