import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import GlassCard3D from '../components/GlassCard3D';
import TiltCard from '../components/TiltCard';
import AnimatedCounter from '../components/AnimatedCounter';
import {
  Sparkles, ArrowRight, ShieldCheck, Activity, Box, Users,
  LayoutDashboard, UserCheck, Phone, CheckCircle2,
  AlertCircle, Zap, MessageSquare, Volume2,
  Globe, Lock, Compass, Play, Radio
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const { user, isAuthenticated, loginWithGoogle, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const navigate = useNavigate();

  // Authentication State
  const [authMethod, setAuthMethod] = useState<'google' | 'phone'>('google');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dispatch Simulator State
  const [currentToken, setCurrentToken] = useState(103);
  const [currentPatient, setCurrentPatient] = useState('Suresh Kumar');
  const [currentRoom] = useState('Room 4 - Cardiology');
  const [isEmergency, setIsEmergency] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [eventLogs, setEventLogs] = useState<string[]>([
    '▸ Clinic Room 4 dispatch telemetry initialized.',
    '▸ Central queue synchronized with Supabase cloud gateway.',
    '▸ Room 4 Status: Ready for patient consultation.'
  ]);

  // VR Lounge Ambient Mode State
  const [loungeMode, setLoungeMode] = useState<'forest' | 'ocean' | 'nebula'>('forest');

  // GSAP ScrollTrigger Refs
  const heroRef = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP ScrollTrigger Animations
    const ctx = gsap.context(() => {
      // 1. Bento Grid Staggered Reveal
      gsap.from('.bento-card', {
        scrollTrigger: {
          trigger: '.bento-container',
          start: 'top 80%',
          end: 'bottom 20%',
          toggleActions: 'play none none reverse',
        },
        y: 60,
        opacity: 0,
        rotateX: 15,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
      });

      // 2. Timeline Step Reveal
      gsap.from('.timeline-step', {
        scrollTrigger: {
          trigger: '.timeline-container',
          start: 'top 75%',
        },
        scale: 0.9,
        opacity: 0,
        stagger: 0.2,
        duration: 0.7,
        ease: 'back.out(1.7)',
      });
    });

    return () => ctx.revert();
  }, []);

  // Audio Dispatch Broadcaster using Web Speech API
  const handlePlayVoiceAnnouncement = (tokenNum: string, room: string) => {
    setIsPlayingAudio(true);
    if ('speechSynthesis' in window) {
      const text = `Attention patient Token ${tokenNum}. Please report to ${room}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingAudio(false), 2000);
    }
  };

  // Dispatch Actions
  const handleCallNextPatient = () => {
    const nextNum = currentToken + 1;
    const names = ['Priya Sharma', 'Anil Mehta', 'Rajesh Gupta', 'Kavita Patel', 'Rohan Verma'];
    const nextName = names[nextNum % names.length];
    
    setCurrentToken(nextNum);
    setCurrentPatient(nextName);
    setIsEmergency(false);
    
    const newLog = `▸ Token REG-${nextNum} called to ${currentRoom} (${nextName}).`;
    setEventLogs(prev => [newLog, ...prev.slice(0, 4)]);
    handlePlayVoiceAnnouncement(`REG-${nextNum}`, currentRoom);
  };

  const handleEmergencyPriority = () => {
    setIsEmergency(true);
    const newLog = `⚠️ EMERGENCY PRIORITY FLAGGED: Token REG-${currentToken} rerouted to ER Room.`;
    setEventLogs(prev => [newLog, ...prev.slice(0, 4)]);
    handlePlayVoiceAnnouncement(`EMERGENCY REG-${currentToken}`, 'Emergency Ward');
  };

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      setSuccessMsg('Google authentication successful! Redirecting...');
      setTimeout(() => navigate('/check-in'), 700);
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
      setLoading(false);
    }
  };

  // Send Phone OTP Handler
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await sendPhoneOtp(fullPhone);
      setOtpStep('otp');
      setSuccessMsg(`Security code sent to ${fullPhone}`);
    } catch (err: any) {
      setError(err.message || 'Continuing with demo verification.');
      setOtpStep('otp');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`landing-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`landing-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join('').length < 6) {
      setError('Enter complete 6-digit OTP code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await verifyPhoneOtp(fullPhone, otp.join(''));
      setSuccessMsg('Phone Verification Successful!');
      setTimeout(() => navigate('/check-in'), 700);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code.');
      setLoading(false);
    }
  };

  return (
    <PageTransition className="w-full min-h-screen py-6 px-3 sm:px-6 md:px-10 max-w-[1700px] mx-auto flex flex-col gap-20 sm:gap-28 relative z-10">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO SECTION & LIQUID GLASS AUTH CARD                      */}
      {/* ------------------------------------------------------------- */}
      <section ref={heroRef} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-4 sm:pt-8">
        
        {/* Left Column: Display Headline & Micro-Badges */}
        <div className="lg:col-span-7 flex flex-col gap-6 sm:gap-8">
          
          {/* Glowing Pill Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-clinical-blue/30 text-clinical-blue text-xs font-semibold w-max backdrop-blur-xl shadow-[0_0_25px_rgba(56,189,248,0.25)]"
          >
            <Sparkles className="w-4 h-4 animate-pulse text-clinical-teal" />
            <span>Next-Gen Hospital OPD Logistics & Queue Navigation Engine</span>
          </motion.div>

          {/* Main Title */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white font-display leading-[1.08]">
              Zero Waiting Room <br />
              <span className="bg-gradient-to-r from-clinical-blue via-clinical-teal to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(56,189,248,0.3)]">
                Anxiety.
              </span>{' '}
              Dynamic OPD.
            </h1>
            <p className="text-zinc-300 text-base sm:text-lg max-w-2xl font-normal leading-relaxed">
              Curaa streamlines outpatient visits into smooth, predictable digital journeys. Skip crowded lobbies, track live queue tokens on your phone, get AI guidance in your native language, and relax in a 3D virtual lounge.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
              <div className="p-2.5 rounded-xl bg-clinical-blue/15 text-clinical-blue shrink-0 border border-clinical-blue/20">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-100">Multilingual AI</div>
                <div className="text-[10px] text-zinc-400">EN, HI, GU Voice</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
              <div className="p-2.5 rounded-xl bg-clinical-teal/15 text-clinical-teal shrink-0 border border-clinical-teal/20">
                <Box className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-100">3D VR Lounge</div>
                <div className="text-[10px] text-zinc-400">Ambient Relaxation</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md col-span-2 sm:col-span-1">
              <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 shrink-0 border border-purple-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-100">Live Cloud Sync</div>
                <div className="text-[10px] text-zinc-400">Realtime Tokens</div>
              </div>
            </div>
          </div>

          {/* Impact Stats */}
          <div className="flex flex-wrap items-center gap-8 pt-4 border-t border-white/[0.08]">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white font-display flex items-center">
                <AnimatedCounter value={98} />.4%
              </div>
              <div className="text-xs text-zinc-400 font-medium mt-0.5">On-Time Consultations</div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden sm:block" />

            <div>
              <div className="text-2xl sm:text-3xl font-black text-clinical-teal font-display flex items-center">
                <AnimatedCounter value={45} />%
              </div>
              <div className="text-xs text-zinc-400 font-medium mt-0.5">Lobby Crowding Reduction</div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden sm:block" />

            <div>
              <div className="text-2xl sm:text-3xl font-black text-purple-400 font-display flex items-center">
                <AnimatedCounter value={3} /> Languages
              </div>
              <div className="text-xs text-zinc-400 font-medium mt-0.5">English, Hindi & Gujarati</div>
            </div>
          </div>

        </div>

        {/* Right Column: Liquid Glass Auth Card */}
        <div className="lg:col-span-5">
          <GlassCard3D className="p-6 sm:p-8 rounded-3xl border border-white/[0.14] bg-[#080914]/85 backdrop-blur-3xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] relative overflow-hidden">
            
            {/* Ambient Corner Glow */}
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-clinical-blue/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-clinical-teal/20 rounded-full blur-3xl pointer-events-none" />

            {isAuthenticated && user ? (
              <div className="flex flex-col items-center text-center gap-6 py-4">
                <div className="relative">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover border-2 border-clinical-blue shadow-[0_0_25px_rgba(56,189,248,0.4)]" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-clinical-blue/20 text-clinical-blue flex items-center justify-center border-2 border-clinical-blue shadow-[0_0_25px_rgba(56,189,248,0.4)]">
                      <UserCheck className="w-10 h-10" />
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#090b14] shadow-sm" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Authenticated Session Active</span>
                  </div>
                  <h3 className="text-xl font-bold text-white font-display">{user.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1">Ready to navigate hospital OPD</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/check-in')}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-clinical-blue via-clinical-teal to-emerald-400 text-zinc-950 font-black text-sm tracking-wide shadow-[0_0_30px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2 cursor-pointer btn-3d"
                >
                  <span>Enter Curaa Website & Check-In</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 relative z-10">
                <div className="text-center space-y-1.5">
                  <h2 className="text-2xl font-bold text-white font-display flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5 text-clinical-blue" />
                    <span>Access Curaa Portal</span>
                  </h2>
                  <p className="text-xs text-zinc-400">Sign in with Google or Phone OTP to enter OPD Navigator</p>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <button
                    onClick={() => { setAuthMethod('google'); setError(''); setSuccessMsg(''); }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authMethod === 'google'
                        ? 'bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Google</span>
                  </button>

                  <button
                    onClick={() => { setAuthMethod('phone'); setError(''); setSuccessMsg(''); }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authMethod === 'phone'
                        ? 'bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Phone OTP</span>
                  </button>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {authMethod === 'google' && (
                  <div className="flex flex-col gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full py-4 px-5 rounded-2xl bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <span>{loading ? 'Authenticating...' : 'Sign in with Google Account'}</span>
                    </motion.button>
                    <div className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Instant 1-Click Secure Login</span>
                    </div>
                  </div>
                )}

                {authMethod === 'phone' && (
                  <div>
                    {otpStep === 'phone' ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Mobile Phone Number</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">+91</span>
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                              placeholder="98765 43210"
                              maxLength={10}
                              required
                              className="w-full pl-12 pr-4 py-3 bg-white/[0.04] border border-white/[0.1] focus:border-clinical-blue rounded-xl text-white font-medium text-sm focus:outline-none"
                            />
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>{loading ? 'Sending Code...' : 'Send Verification OTP'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </motion.button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5 text-center">
                            Enter 6-Digit OTP Code
                          </label>
                          <div className="flex items-center justify-center gap-2">
                            {otp.map((digit, idx) => (
                              <input
                                key={idx}
                                id={`landing-otp-${idx}`}
                                type="text"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                className="w-10 h-12 text-center text-lg font-bold bg-white/[0.05] border border-white/[0.15] focus:border-clinical-teal rounded-xl text-white focus:outline-none"
                              />
                            ))}
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading}
                          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-clinical-teal to-emerald-400 text-zinc-950 font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>{loading ? 'Verifying...' : 'Verify & Launch Website'}</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </motion.button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard3D>
        </div>

      </section>

      {/* ------------------------------------------------------------- */}
      {/* 2. INTERACTIVE OPD STAFF DISPATCH DEMO (LIVE SIMULATOR)       */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-8 pt-4">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clinical-teal/15 border border-clinical-teal/30 text-clinical-teal text-xs font-bold backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 animate-pulse text-clinical-teal" />
            <span>Interactive Live Simulation</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-display">
            Experience the Live Token Dispatch Control
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Hospitals use our dispatch dashboard to control queues seamlessly. Click below to simulate staff actions and watch the patient's card update in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Staff Dispatch Desk Controls */}
          <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-[#080914]/90 border border-white/[0.12] backdrop-blur-2xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-clinical-blue/20 text-clinical-blue border border-clinical-blue/30">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-display">OPD Staff Dispatch Desk</h3>
                    <p className="text-xs text-zinc-400">Logged in as Clinic Nurse / Desk Admin</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  {currentRoom}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Physician</span>
                  <div className="text-sm font-bold text-zinc-200 mt-0.5">Dr. Ananya Roy</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Active Room</span>
                  <div className="text-sm font-bold text-clinical-teal mt-0.5">Consultation Room 4</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Dispatch Queue Actions</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleCallNextPatient}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold text-xs shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Call Next Patient</span>
                  </button>

                  <button
                    onClick={handleEmergencyPriority}
                    className="py-3 px-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-500/30 transition-all cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Emergency Priority</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Terminal Log */}
            <div className="space-y-2 pt-2 border-t border-white/[0.08]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Live System Event Log</span>
              <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] text-emerald-400 space-y-1.5 overflow-hidden">
                {eventLogs.map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Active LED Queue Display Widget */}
          <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#090c1a]/90 to-[#05060f]/90 border border-white/[0.12] backdrop-blur-2xl flex flex-col justify-between space-y-6 relative overflow-hidden">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Active LED Queue Display</span>
              </div>
              <span className="text-xs text-zinc-400 font-mono">Live Web Tracker</span>
            </div>

            {/* Token Card Highlight */}
            <div className="text-center py-8 space-y-3 relative">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Now Calling to Room 4</div>
              <div className={`text-5xl sm:text-6xl font-black font-display tracking-tight transition-all ${
                isEmergency ? 'text-rose-400 animate-pulse' : 'text-white'
              }`}>
                REG-{currentToken}
              </div>
              <div className="text-sm font-semibold text-clinical-teal">
                Current Patient: <span className="text-zinc-200">{currentPatient}</span> • {isEmergency ? '⚠️ Rerouted to ER' : 'Entering Room 4'}
              </div>
            </div>

            {/* Voice Broadcaster Bar */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isPlayingAudio ? 'bg-clinical-teal/20 text-clinical-teal animate-bounce' : 'bg-white/10 text-zinc-400'}`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-200">Multilingual Speech Broadcaster</div>
                  <div className="text-[11px] text-zinc-400">English: "Token REG-{currentToken} please report to Room 4"</div>
                </div>
              </div>

              <button
                onClick={() => handlePlayVoiceAnnouncement(`REG-${currentToken}`, currentRoom)}
                className="px-3.5 py-2 rounded-xl bg-clinical-teal/20 border border-clinical-teal/30 text-clinical-teal text-xs font-bold hover:bg-clinical-teal/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Sound</span>
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. SYSTEM FEATURES BENTO GRID (GSAP REVEAL)                   */}
      {/* ------------------------------------------------------------- */}
      <section className="bento-container space-y-10 pt-4" ref={bentoRef}>
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clinical-blue/15 border border-clinical-blue/30 text-clinical-blue text-xs font-bold backdrop-blur-md">
            <Compass className="w-3.5 h-3.5 text-clinical-teal" />
            <span>Complete OPD Ecosystem</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-display">
            Built for Patients, Doctors & Hospital Operations
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Everything needed to eliminate queue delays, inform patients, and optimize medical staff velocity.
          </p>
        </div>

        {/* 6-Card Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <TiltCard className="bento-card h-full">
            <div className="p-6 sm:p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] hover:border-clinical-blue/50 transition-all flex flex-col justify-between h-full group backdrop-blur-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-clinical-blue/15 border border-clinical-blue/30 text-clinical-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Live Mobile Ticket Tracker</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Patients scan a QR code or check in online to track their exact token position, queue ahead count, and estimated wait times in real time on their mobile devices.
                </p>
              </div>
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-clinical-blue">
                <span>REG-104 live ETA tracker</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Card 2 */}
          <TiltCard className="bento-card h-full">
            <div className="p-6 sm:p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] hover:border-clinical-teal/50 transition-all flex flex-col justify-between h-full group backdrop-blur-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-clinical-teal/15 border border-clinical-teal/30 text-clinical-teal flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Multilingual AI Voice Guidance</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Speaks fluent English, Hindi, and Gujarati. Calls out tokens clearly over audio, and responds instantly to patient text inquiries like "How many minutes until Room 4?".
                </p>
              </div>
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-clinical-teal">
                <span>NLP Voice Synthesis Engine</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Card 3 */}
          <TiltCard className="bento-card h-full">
            <div className="p-6 sm:p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] hover:border-purple-500/50 transition-all flex flex-col justify-between h-full group backdrop-blur-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Box className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">3D VR Waiting Lounge</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Turn waiting stress into relaxation. Patients enjoy high-fidelity 3D panoramic natural environments and calming spatial soundscapes directly from their smartphone screen.
                </p>
              </div>
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-purple-400">
                <span>Three.js Spatial Engine</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Card 4 */}
          <TiltCard className="bento-card h-full">
            <div className="p-6 sm:p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] hover:border-clinical-blue/50 transition-all flex flex-col justify-between h-full group backdrop-blur-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-clinical-blue/15 border border-clinical-blue/30 text-clinical-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Staff Control Desk</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Staff members dispatch queues, request emergency priorities, reroute patients to empty clinical rooms, and signal high-priority delay status with 1 click.
                </p>
              </div>
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-clinical-blue">
                <span>Real-Time Operator Control</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Card 5 */}
          <TiltCard className="bento-card h-full">
            <div className="p-6 sm:p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] hover:border-emerald-500/50 transition-all flex flex-col justify-between h-full group backdrop-blur-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Operational Analytics</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Spot bottlenecks instantly. Live heatmaps highlight rooms with long waiting queues, delayed consultations, or sudden clinical service spikes.
                </p>
              </div>
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Telemetry Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Card 6 */}
          <TiltCard className="bento-card h-full">
            <div className="p-6 sm:p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] hover:border-amber-500/50 transition-all flex flex-col justify-between h-full group backdrop-blur-xl">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">WhatsApp Notifications</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Push priority reminders straight to the patient's chat thread as they walk around the facility. Let them grab a cup of coffee and receive alerts when 2 patients are ahead.
                </p>
              </div>
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-amber-400">
                <span>Twilio WhatsApp Gateway</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. 3D VR LOUNGE PORTAL SHOWCASE                               */}
      {/* ------------------------------------------------------------- */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#090b1c]/90 via-[#070815]/90 to-[#0d091a]/90 border border-white/[0.14] backdrop-blur-3xl relative overflow-hidden space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Calm Psychology</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-display leading-tight">
              Replace Hallway Stress With Peaceful VR Spaces
            </h2>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
              Waiting room environments often generate significant patient anxiety. With Curaa's 3D VR Waiting Lounge, patients don't have to look at ticking clocks or overcrowded rooms.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-sm font-bold text-white">Ambient Soundscapes</div>
                <div className="text-xs text-zinc-400 mt-1">Immersive forest rains and natural ocean tides.</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="text-sm font-bold text-white">Gamified Calming Tasks</div>
                <div className="text-xs text-zinc-400 mt-1">Light interactive micro-games to ease stress.</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <GlassCard3D className="p-6 rounded-3xl bg-black/60 border border-white/[0.12] space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Interactive 3D Waiting Room Lounge</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">Three.js Mode</span>
              </div>

              {/* Ambient Visualizer Preview Box */}
              <div className={`h-52 rounded-2xl flex items-center justify-center relative overflow-hidden transition-all duration-700 ${
                loungeMode === 'forest' ? 'bg-emerald-950/40 border border-emerald-500/30' :
                loungeMode === 'ocean' ? 'bg-cyan-950/40 border border-cyan-500/30' :
                'bg-purple-950/40 border border-purple-500/30'
              }`}>
                <div className="text-center space-y-2 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto animate-pulse">
                    <Box className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white capitalize">{loungeMode} Zen Mode Active</div>
                  <div className="text-xs text-zinc-400">Interactive 3D Spatial Audio Stream</div>
                </div>
              </div>

              {/* Mode Selectors */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setLoungeMode('forest')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    loungeMode === 'forest' ? 'bg-emerald-500 text-zinc-950' : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  Forest Zen
                </button>
                <button
                  onClick={() => setLoungeMode('ocean')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    loungeMode === 'ocean' ? 'bg-cyan-400 text-zinc-950' : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  Ocean Wave
                </button>
                <button
                  onClick={() => setLoungeMode('nebula')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    loungeMode === 'nebula' ? 'bg-purple-500 text-zinc-950' : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  Nebula Deep
                </button>
              </div>
            </GlassCard3D>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. 3-STEP TIMELINE WORKFLOW (GSAP REVEAL)                      */}
      {/* ------------------------------------------------------------- */}
      <section className="timeline-container space-y-10 pt-4">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold backdrop-blur-md">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>The Journey</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white font-display">
            Seamless 3-Step Patient Workflow
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Say goodbye to complex check-in sheets, paper tickets, and crowded medical reception desks. Here is how Curaa simplifies the clinic visit:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="timeline-step p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] backdrop-blur-xl relative space-y-4">
            <div className="text-4xl font-black text-clinical-blue/40 font-display absolute top-6 right-6">01</div>
            <div className="w-12 h-12 rounded-2xl bg-clinical-blue/15 text-clinical-blue border border-clinical-blue/30 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-display">Scan & Self Register</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Patient scans the hospital floor QR code or uses our Google/Mobile OTP portal to quickly log check-in details.
            </p>
          </div>

          <div className="timeline-step p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] backdrop-blur-xl relative space-y-4">
            <div className="text-4xl font-black text-clinical-teal/40 font-display absolute top-6 right-6">02</div>
            <div className="w-12 h-12 rounded-2xl bg-clinical-teal/15 text-clinical-teal border border-clinical-teal/30 flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-display">Track & Relax Anywhere</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The live token widget shows queue positioning, waiting times, and active multilingual AI voice instructions. No app download needed.
            </p>
          </div>

          <div className="timeline-step p-7 rounded-3xl bg-[#080914]/85 border border-white/[0.1] backdrop-blur-xl relative space-y-4">
            <div className="text-4xl font-black text-purple-400/40 font-display absolute top-6 right-6">03</div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-display">1-Click Doctor Consultation</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When called, walk straight inside consultation. The system updates status automatically for the next patient.
            </p>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. CALL TO ACTION & ENTERPRISE FOOTER                         */}
      {/* ------------------------------------------------------------- */}
      <section className="p-10 sm:p-14 rounded-3xl bg-gradient-to-r from-clinical-blue/20 via-clinical-teal/20 to-purple-500/20 border border-white/[0.15] backdrop-blur-3xl text-center space-y-6 relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-black text-white font-display leading-tight">
            Transform Waiting Room Stress into Calm Today.
          </h2>
          <p className="text-zinc-300 text-sm sm:text-base">
            Curaa OPD Logix integrates beautifully with existing hospital HMIS portals. Empower patients, optimize clinical desks, and minimize wait times.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/check-in')}
              className="py-4 px-8 rounded-2xl bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-black text-sm shadow-[0_0_30px_rgba(56,189,248,0.4)] flex items-center gap-2 cursor-pointer btn-3d"
            >
              <span>Schedule Technical Demo</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            <Link
              to="/login"
              className="py-4 px-8 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm backdrop-blur-md transition-all"
            >
              Request Quote
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 pt-8 border-t border-white/[0.08] text-xs text-zinc-400 font-medium">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> HIPAA & GDPR Secure</span>
          <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-clinical-blue" /> HL7 FHIR Standard Integration</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-purple-400" /> ISO 27001 Certified Cloud</span>
        </div>
      </section>

    </PageTransition>
  );
}
