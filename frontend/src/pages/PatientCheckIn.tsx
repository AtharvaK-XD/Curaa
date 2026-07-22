import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ClipboardList, Info, ShieldCheck, Sparkles, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import TiltCard from '../components/TiltCard';
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
    <PageTransition className="flex-1 max-w-6xl 2xl:max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-10 py-6 sm:py-12 flex flex-col justify-center overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
        
        {/* Left Side: Information & Live Ticket Preview */}
        <div className="lg:col-span-5 flex">
          <TiltCard className="w-full bg-gradient-to-br from-[#0b0d18] to-[#04050a] rounded-3xl p-5 sm:p-8 text-white flex flex-col justify-between border border-white/[0.08] clinical-shadow">
            <div>
              <div className="flex items-center justify-between mb-6">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.05 }}
                  className="inline-flex items-center justify-center p-3 bg-clinical-blue/10 border border-clinical-blue/20 rounded-2xl shadow-inner translate-z-30"
                >
                  <ClipboardList className="w-7 h-7 text-clinical-blue" />
                </motion.div>

                <span className="text-[9px] font-bold text-clinical-emerald uppercase tracking-widest bg-clinical-emerald/10 border border-clinical-emerald/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 translate-z-20">
                  <span className="w-1.5 h-1.5 rounded-full bg-clinical-emerald animate-pulse"></span>
                  <span>Active Terminal</span>
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight mb-3 text-zinc-100 font-display translate-z-20">
                Smart OPD <br />Queue Navigator
              </h2>
              <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                Skip crowded lobbies and long billing queues. Register below to receive a dynamic digital tracking token on your phone.
              </p>
              
              {/* Live Dynamic Ticket Preview Card */}
              <motion.div 
                layout
                className="bg-[#05060c] border border-clinical-blue/30 rounded-2xl p-4 shadow-[0_0_25px_rgba(56,189,248,0.15)] relative overflow-hidden mb-6 translate-z-40"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-clinical-blue/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-clinical-blue" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Live Token Draft</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-clinical-teal bg-clinical-teal/10 px-2 py-0.5 rounded border border-clinical-teal/20">
                    {name ? `T-10${(name.length * 3) % 90 + 10}` : 'T-102'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-[11px]">Patient:</span>
                    <span className="font-bold text-zinc-100 truncate max-w-[180px]">
                      {name.trim() || <span className="text-zinc-650 italic">Entering Name...</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-[11px]">Contact:</span>
                    <span className="font-semibold text-zinc-300 font-mono">
                      {phone.trim() || <span className="text-zinc-650 italic">Entering Phone...</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-[11px]">Assigned Doctor:</span>
                    <span className="text-clinical-teal font-semibold text-[11px]">
                      {doctorName.trim() || 'General OPD Room 12'}
                    </span>
                  </div>
                </div>
              </motion.div>

              <div className="space-y-4">
                <div className="flex gap-4 items-center bg-[#06070d] p-2.5 rounded-2xl border border-white/[0.04]">
                  <div className="w-7 h-7 rounded-full bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center text-xs font-bold text-clinical-blue shrink-0 shadow-sm">1</div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Generate Digital Token</h4>
                    <p className="text-[10px] text-zinc-550">Register in seconds with your name and phone number.</p>
                  </div>
                </div>
                
                <div className="flex gap-4 items-center bg-[#06070d] p-2.5 rounded-2xl border border-white/[0.04]">
                  <div className="w-7 h-7 rounded-full bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-xs font-bold text-clinical-teal shrink-0 shadow-sm">2</div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Live Pathway Progress</h4>
                    <p className="text-[10px] text-zinc-550">See exact queue positioning in real-time on your mobile device.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/[0.04] flex items-center gap-3 text-[10px] text-zinc-500 font-medium leading-relaxed">
              <Info className="w-4 h-4 shrink-0 text-zinc-650" />
              <span>Secure logistics portal. This tool does not issue medical diagnosis or triage priority.</span>
            </div>
          </TiltCard>
        </div>

        {/* Right Side: Check-in Actions (3D Dark Glass Panel) */}
        <div className="lg:col-span-7 flex">
          <TiltCard className="w-full bg-[#070914]/80 backdrop-blur-xl rounded-3xl p-5 sm:p-8 border border-white/[0.08] clinical-shadow flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <div>
                <span className="text-[9px] font-bold text-clinical-blue uppercase tracking-widest bg-clinical-blue/10 border border-clinical-blue/20 px-2.5 py-1 rounded-md">OPD Check-in</span>
                <h3 className="text-xl font-bold text-zinc-100 mt-2 font-display">New Patient Entry</h3>
              </div>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleQuickDemoCheckin}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 text-amber-350 text-xs font-bold rounded-xl border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Simulate Demo Journey</span>
              </motion.button>
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
                  <label className="block text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-2">Preferred AI Language</label>
                  {/* Motion Language Selector Tabs */}
                  <div className="grid grid-cols-3 gap-1 bg-[#050508] p-1 rounded-xl border border-white/[0.08] relative">
                    {[
                      { id: 'en', label: 'English' },
                      { id: 'hi', label: 'हिंदी' },
                      { id: 'gu', label: 'ગુજરાતી' },
                    ].map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setLanguage(lang.id as any)}
                        className="relative py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center z-10 select-none"
                      >
                        {language === lang.id && (
                          <motion.div
                            layoutId="langPill"
                            className="absolute inset-0 bg-clinical-blue rounded-lg shadow-[0_0_12px_rgba(56,189,248,0.3)] -z-10"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className={language === lang.id ? 'text-zinc-950 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'}>
                          {lang.label}
                        </span>
                      </button>
                    ))}
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

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-[0_0_25px_rgba(56,189,248,0.4)] transition-all duration-200 flex items-center justify-center gap-2 text-xs font-display uppercase tracking-widest btn-3d cursor-pointer mt-6"
              >
                <UserCheck className="w-4 h-4 text-zinc-950" />
                <span>{loading ? 'Processing check-in...' : 'Register & Join Dynamic Queue'}</span>
              </motion.button>
            </form>
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-zinc-650 font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-clinical-teal" />
              <span>Instant AI ticket mapping enabled</span>
            </span>
          </div>
        </TiltCard>
      </div>

      </div>
    </PageTransition>
  );
}

