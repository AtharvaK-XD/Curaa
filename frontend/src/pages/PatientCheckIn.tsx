import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, QrCode, ClipboardList, Info, HelpCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function PatientCheckIn() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'gu'>('en');
  const [doctorName, setDoctorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Please fill in both Name and Phone number.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          preferred_language: language,
          doctor_name: doctorName.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Check-in failed');
      }

      const token = await res.json();
      navigate(`/patient/${token.id}`);
    } catch (err: any) {
      console.error('Error during check-in:', err);
      setError(err.message || 'Unable to connect to server. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoCheckin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Rahul Sharma',
          phone: '+919876543210',
          preferred_language: 'en',
          doctor_name: 'Dr. Ramesh Kumar (OPD Room 12)'
        })
      });

      if (!res.ok) throw new Error('Demo check-in failed');
      const token = await res.json();
      navigate(`/patient/${token.id}`);
    } catch (err: any) {
      setError('E2E server connection failed. Running in static preview mode.');
      // Fallback preview
      setTimeout(() => {
        navigate('/patient/demo');
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col justify-center">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Left Side: Information & Branding (3D Styled Card) */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl p-8 text-white flex flex-col justify-between border border-zinc-800/80 card-3d clinical-shadow">
          <div>
            <div className="inline-flex items-center justify-center p-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl mb-6 shadow-inner depth-3d-element">
              <ClipboardList className="w-8 h-8 text-clinical-blue" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-3 depth-3d-text text-zinc-100">
              OPD Queue Navigator
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Avoid crowded lobbies and confusing hospital corridors. Scan your QR appointment or check in below to receive a live digital tracking token.
            </p>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-clinical-blue/20 border border-clinical-blue/30 flex items-center justify-center text-xs font-bold text-clinical-blue shrink-0 mt-0.5">1</div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Generate Token</h4>
                  <p className="text-xs text-zinc-500">Register in seconds using your name and phone number.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-clinical-blue/20 border border-clinical-blue/30 flex items-center justify-center text-xs font-bold text-clinical-blue shrink-0 mt-0.5">2</div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Track Live Progress</h4>
                  <p className="text-xs text-zinc-500">See exactly how many patients are ahead of you in real-time.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-clinical-blue/20 border border-clinical-blue/30 flex items-center justify-center text-xs font-bold text-clinical-blue shrink-0 mt-0.5">3</div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Interact with AI Logistics</h4>
                  <p className="text-xs text-zinc-500">Ask "where do I go next" or "how long to wait" in English, Hindi, or Gujarati.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-center gap-2.5 text-xs text-zinc-500 font-medium">
            <Info className="w-4 h-4 shrink-0 text-zinc-600" />
            <span>This tool does not provide medical diagnosis.</span>
          </div>
        </div>

        {/* Right Side: Check-in Actions (3D Dark Glass Panel) */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-zinc-800/80 card-3d clinical-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-200">New Patient Check-in</h3>
              
              <button 
                onClick={handleQuickDemoCheckin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/20 hover:bg-amber-950/40 text-amber-400 text-xs font-bold rounded-lg border border-amber-800/60 shadow-[0_0_10px_rgba(245,158,11,0.08)] hover:shadow-[0_0_15px_rgba(245,158,11,0.18)] transition-all duration-200 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Quick E2E Demo</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-rose-950/20 border-l-4 border-rose-500 rounded-r-lg text-rose-300 text-xs font-medium leading-relaxed border border-rose-900/50">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950/80 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-clinical-blue transition-all text-sm text-zinc-100 placeholder-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950/80 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-clinical-blue transition-all text-sm text-zinc-100 placeholder-zinc-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Preferred Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950/80 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-clinical-blue transition-all text-sm text-zinc-100"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="gu">ગુજરાતી (Gujarati)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Scheduled Doctor / OPD Room (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Ramesh Kumar (OPD Room 12)"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-950/80 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue focus:border-clinical-blue transition-all text-sm text-zinc-100 placeholder-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-clinical-blue hover:bg-sky-400 text-zinc-950 font-extrabold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-50 btn-3d cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-zinc-950" />
                <span>{loading ? 'Registering...' : 'Register & Check-in'}</span>
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-600" />
              <span>Need help? Ask AI at next step</span>
            </span>
            <span>Version 1.0.0</span>
          </div>
        </div>

      </div>
    </div>
  );
}
