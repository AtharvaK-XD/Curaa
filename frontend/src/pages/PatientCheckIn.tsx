import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ClipboardList, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { mockDatabase } from '../lib/mockDatabase';

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

    if (!isSupabaseConfigured) {
      // Offline fallback
      setTimeout(() => {
        try {
          const token = mockDatabase.checkIn(
            name.trim(),
            phone.trim(),
            language,
            doctorName.trim() || undefined
          );
          navigate(`/patient/${token.id}`);
        } catch (err: any) {
          setError('Local check-in failed: ' + err.message);
        } finally {
          setLoading(false);
        }
      }, 600);
      return;
    }

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
      // Fallback to local storage mock database if server connection failed
      setError('Live server connection failed. Registering in Offline Demo Mode...');
      setTimeout(() => {
        const token = mockDatabase.checkIn(
          name.trim(),
          phone.trim(),
          language,
          doctorName.trim() || undefined
        );
        navigate(`/patient/${token.id}`);
        setLoading(false);
      }, 1500);
    }
  };

  const handleQuickDemoCheckin = async () => {
    setLoading(true);
    setError('');
    
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const token = mockDatabase.checkIn(
          'Rahul Sharma',
          '+919876543210',
          'en',
          'Dr. Ramesh Kumar (OPD Room 12)'
        );
        navigate(`/patient/${token.id}`);
        setLoading(false);
      }, 800);
      return;
    }

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
      setError('E2E server connection failed. Launching Local Demo Portal...');
      setTimeout(() => {
        const token = mockDatabase.checkIn(
          'Rahul Sharma',
          '+919876543210',
          'en',
          'Dr. Ramesh Kumar (OPD Room 12)'
        );
        navigate(`/patient/${token.id}`);
        setLoading(false);
      }, 1200);
    }
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Information & Branding (3D Styled Card) */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 bg-gradient-to-br from-[#0b0c16] to-[#05060d] rounded-3xl p-8 text-white flex flex-col justify-between border border-white/[0.05] card-3d clinical-shadow"
        >
          <div>
            <div className="inline-flex items-center justify-center p-3 bg-clinical-blue/10 border border-clinical-blue/20 rounded-2xl mb-6 shadow-inner depth-3d-element">
              <ClipboardList className="w-7 h-7 text-clinical-blue" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-3 depth-3d-text text-zinc-100 font-display">
              Smart OPD <br />Queue Navigator
            </h2>
            <p className="text-zinc-400 text-xs leading-relaxed mb-8">
              Skip crowded lobbies and long billing queues. Register below to receive a dynamic digital tracking token on your phone.
            </p>
            
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center text-xs font-bold text-clinical-blue shrink-0 mt-0.5 shadow-sm">1</div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Generate Token</h4>
                  <p className="text-[11px] text-zinc-550 mt-0.5">Register in seconds with your name and phone number.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-xs font-bold text-clinical-teal shrink-0 mt-0.5 shadow-sm">2</div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Track Pathway Progress</h4>
                  <p className="text-[11px] text-zinc-550 mt-0.5">See exactly how many patients are ahead of you in real-time.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-clinical-purple/10 border border-clinical-purple/20 flex items-center justify-center text-xs font-bold text-clinical-purple shrink-0 mt-0.5 shadow-sm">3</div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Logistics AI Guide</h4>
                  <p className="text-[11px] text-zinc-550 mt-0.5">Ask "where to go next" or wait estimations in English, Hindi, or Gujarati.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.04] flex items-center gap-3 text-[10px] text-zinc-500 font-medium leading-relaxed">
            <Info className="w-4 h-4 shrink-0 text-zinc-650" />
            <span>Secure logistics portal. This tool does not issue medical diagnosis or triage priority.</span>
          </div>
        </motion.div>

        {/* Right Side: Check-in Actions (3D Dark Glass Panel) */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 bg-[#0a0a10]/60 backdrop-blur-xl rounded-3xl p-8 border border-white/[0.05] clinical-shadow flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-[9px] font-bold text-clinical-blue uppercase tracking-widest bg-clinical-blue/10 border border-clinical-blue/20 px-2 py-0.5 rounded-md">OPD Check-in</span>
                <h3 className="text-xl font-bold text-zinc-100 mt-2 font-display">New Patient Entry</h3>
              </div>
              
              <button 
                onClick={handleQuickDemoCheckin}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-bold rounded-xl border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.05)] transition-all duration-200 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Simulate Demo Journey</span>
              </button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-rose-500/10 border-l-2 border-rose-500 rounded-r-xl text-rose-350 text-xs font-semibold leading-relaxed border border-rose-500/20"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-zinc-200 placeholder-zinc-700 neon-input focus:outline-none focus:ring-0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-2">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-zinc-200 placeholder-zinc-700 neon-input focus:outline-none focus:ring-0"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-2">Preferred Language</label>
                  <div className="relative">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-zinc-300 bg-[#08080c] border border-white/[0.08] focus:border-clinical-blue focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="en">English (US/UK)</option>
                      <option value="hi">हिंदी (Hindi)</option>
                      <option value="gu">ગુજરાતી (Gujarati)</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">
                      ▼
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-2">Doctor / OPD Room (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh (OPD Room 12)"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-zinc-200 placeholder-zinc-700 neon-input focus:outline-none focus:ring-0"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all duration-200 flex items-center justify-center gap-2 text-xs font-display uppercase tracking-widest btn-3d cursor-pointer mt-6"
              >
                <UserCheck className="w-4 h-4 text-zinc-950" />
                <span>{loading ? 'Processing check-in...' : 'Register & Join Queue'}</span>
              </button>
            </form>
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-zinc-650 font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-clinical-teal" />
              <span>Instant AI ticket mapping enabled</span>
            </span>
            <span>Version 1.1.0 (Glassmorphic edition)</span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
