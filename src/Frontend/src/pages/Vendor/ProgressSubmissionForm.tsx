import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

interface Props {
  projectId: string;
  projectName: string;
  currentProgress: number;
  onSuccess: () => void;
}

export const ProgressSubmissionForm = ({ projectId, projectName, currentProgress, onSuccess }: Props) => {
  const [percentage, setPercentage] = useState(currentProgress);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Automatically capture geo-location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location error", err)
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      alert("Geo-location is mandatory for progress reporting.");
      return;
    }
    if (files.length === 0) {
      alert("At least one photo/video evidence is required.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload files first (mocking here for brevity, would use FilesController)
      const mediaUrls = files.map(f => `mock_url_${f.name}`);

      // 2. Submit report
      await axiosInstance.post('/progressreports', {
        projectId,
        physicalPercentage: percentage,
        workDescription: description,
        latitude: location.lat,
        longitude: location.lng,
        mediaUrls
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to submit the progress report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-2xl mx-auto">
      <div className="bg-blue-700 p-6 text-white">
        <h2 className="text-xl font-bold">Report Work Progress</h2>
        <p className="text-blue-100 text-sm mt-1">{projectName}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
            <span>Physical Completion (%)</span>
            <span className="text-blue-700">{percentage}%</span>
          </label>
          <input 
            type="range" min="0" max="100" step="1"
            value={percentage}
            onChange={(e) => setPercentage(Number(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-700"
          />
          <div className="flex justify-between text-[10px] font-bold text-slate-600 mt-2 uppercase tracking-widest">
            <span>Current: {currentProgress}%</span>
            <span>Target: 100%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Work Description</label>
          <textarea 
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the tasks completed in this period..."
            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm leading-relaxed"
          />
        </div>

        {/* Geo-tagging Info */}
        <div className={`p-4 rounded-xl border flex items-center space-x-4 ${location ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          <div className={`p-2 rounded-lg ${location ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider">Geo-Location Status</p>
            <p className="text-sm font-medium">
              {location ? `Captured: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting for GPS signal...'}
            </p>
          </div>
          {location && <CheckCircle className="w-5 h-5" />}
        </div>

        {/* Media Upload */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Evidence Upload (Images/Video)</label>
          <div className="grid grid-cols-4 gap-4">
            {files.map((f, i) => (
              <div key={i} className="aspect-square bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-[10px] text-slate-600 font-bold overflow-hidden relative group">
                <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="preview" />
                <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full hidden group-hover:flex items-center justify-center">×</button>
              </div>
            ))}
            <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
              <Camera className="w-6 h-6 text-slate-600" />
              <span className="text-[10px] font-bold text-slate-600 mt-2 uppercase">Capture</span>
              <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => setFiles([...files, ...Array.from(e.target.files || [])])} />
            </label>
          </div>
        </div>

        <div className="pt-4">
          <button 
            type="submit"
            disabled={submitting || !location}
            className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled: disabled:shadow-none"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Submit Immutable Report</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-600 text-center mt-3 uppercase tracking-widest font-bold">
            Note: Once submitted, reports are digitally signed and cannot be edited.
          </p>
        </div>
      </form>
    </div>
  );
};
