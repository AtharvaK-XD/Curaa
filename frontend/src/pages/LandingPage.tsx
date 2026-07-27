import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import GlassCard3D from '../components/GlassCard3D';
import TiltCard from '../components/TiltCard';
import AnimatedCounter from '../components/AnimatedCounter';
import {
  Sparkles, ArrowRight, ShieldCheck, Activity, Box, Users,
  LayoutDashboard, UserCheck, Phone, CheckCircle2,
  AlertCircle, Zap, MessageSquare, Bell,
  Globe, ChevronRight, Lock, Compass
} from 'lucide-react';

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

  // If user is already authenticated, allow instant navigation to main site
  const handleProceedToApp = () => {
    navigate('/check-in');
  };

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      setSuccessMsg('Google authentication successful! Redirecting to main website...');
      setTimeout(() => {
        navigate('/check-in');
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Google authentication failed. Please try again.');
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
      setError(err.message || 'Failed to send SMS OTP. Continuing with demo verification.');
      setOtpStep('otp');
    } finally {
      setLoading(false);
    }
  };

  // OTP Change Handler
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

  // OTP Keydown (Backspace) Handler
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`landing-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Verify Phone OTP Handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await verifyPhoneOtp(fullPhone, enteredOtp);
      setSuccessMsg('Phone Verification Successful! Accessing main website...');
      setTimeout(() => {
        navigate('/check-in');
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code. Please try again.');
      setLoading(false);
    }
  };

  return (
    <PageTransition className="w-full min-h-screen py-6 px-3 sm:px-6 md:px-10 max-w-[1700px] mx-auto flex flex-col gap-16 sm:gap-24 relative">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO SECTION & QUICK AUTH CARD                             */}
      {/* ------------------------------------------------------------- */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-4 sm:pt-8">
        
        {/* Left Column: Headline, Value Proposition & Features Badges */}
        <div className="lg:col-span-7 flex flex-col gap-6 sm:gap-8">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-clinical-blue/10 border border-clinical-blue/25 text-clinical-blue text-xs font-semibold w-max shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <Sparkles className="w-4 h-4 animate-pulse text-clinical-teal" />
            <span>Next-Gen Hospital OPD Logistics & Queue Navigation Engine</span>
          </div>

          {/* Main Title */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white font-display leading-[1.15]">
              Zero Waiting Room Anxiety. <br />
              <span className="bg-gradient-to-r from-clinical-blue via-clinical-teal to-purple-400 bg-clip-text text-transparent">
                Dynamic OPD Navigation.
              </span>
            </h1>
            <p className="text-zinc-300 text-sm sm:text-base lg:text-lg max-w-2xl font-normal leading-relaxed">
              Curaa streamlines outpatient visits into smooth, predictable journeys. Skip crowded lobbies, receive real-time queue tokens, get guidance from an AI assistant in your native language, and relax in an immersive 3D virtual lounge while waiting.
            </p>
          </div>

          {/* Feature Micro-Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="p-2 rounded-lg bg-clinical-blue/10 text-clinical-blue shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-zinc-200">Multilingual AI</div>
                <div className="text-[10px] text-zinc-400">English, Hindi, Gujarati</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="p-2 rounded-lg bg-clinical-teal/10 text-clinical-teal shrink-0">
                <Box className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-zinc-200">3D VR Lounge</div>
                <div className="text-[10px] text-zinc-400">Interactive Relaxation</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] col-span-2 sm:col-span-1">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-zinc-200">Live Cloud Sync</div>
                <div className="text-[10px] text-zinc-400">Realtime Queue Updates</div>
              </div>
            </div>
          </div>

          {/* Impact Metrics Summary */}
          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/[0.06]">
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-display flex items-center">
                <AnimatedCounter value={98} />.4%
              </div>
              <div className="text-[11px] text-zinc-400 font-medium">On-Time Consultations</div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-clinical-teal font-display flex items-center">
                <AnimatedCounter value={45} />%
              </div>
              <div className="text-[11px] text-zinc-400 font-medium">Reduced Lobby Crowding</div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-purple-400 font-display flex items-center">
                <AnimatedCounter value={3} /> Languages
              </div>
              <div className="text-[11px] text-zinc-400 font-medium">English, Hindi & Gujarati NLP</div>
            </div>
          </div>

        </div>

        {/* Right Column: Quick Authentication Box */}
        <div className="lg:col-span-5">
          <GlassCard3D className="p-6 sm:p-8 rounded-3xl border border-white/[0.12] bg-[#090b14]/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
            
            {/* Ambient Corner Glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-clinical-blue/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-clinical-teal/20 rounded-full blur-3xl pointer-events-none" />

            {isAuthenticated && user ? (
              /* ALREADY LOGGED IN VIEW */
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
                  <p className="text-xs text-zinc-400 mt-1">{user.email || user.phone || 'Ready to navigate hospital OPD'}</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleProceedToApp}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-clinical-blue via-clinical-teal to-emerald-400 text-zinc-950 font-black text-sm tracking-wide shadow-[0_0_30px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2 cursor-pointer btn-3d"
                >
                  <span>Enter Curaa Website & Check-In</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            ) : (
              /* LOGIN FORM VIEW */
              <div className="flex flex-col gap-6 relative z-10">
                <div className="text-center space-y-1.5">
                  <h2 className="text-2xl font-bold text-white font-display flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5 text-clinical-blue" />
                    <span>Access Curaa Portal</span>
                  </h2>
                  <p className="text-xs text-zinc-400">Sign in with Google or Phone OTP to enter the OPD Navigator</p>
                </div>

                {/* Authentication Method Selector Tabs */}
                <div className="grid grid-cols-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <button
                    onClick={() => { setAuthMethod('google'); setError(''); setSuccessMsg(''); }}
                    className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authMethod === 'google'
                        ? 'bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    onClick={() => { setAuthMethod('phone'); setError(''); setSuccessMsg(''); }}
                    className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authMethod === 'phone'
                        ? 'bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    <span>Phone OTP</span>
                  </button>
                </div>

                {/* Notifications & Alert Messages */}
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {successMsg && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </motion.div>
                )}

                {/* GOOGLE SIGN IN TAB */}
                {authMethod === 'google' && (
                  <div className="flex flex-col gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full py-4 px-5 rounded-2xl bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{loading ? 'Authenticating...' : 'Sign in with Google Account'}</span>
                    </motion.button>

                    <div className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 pt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Instant 1-Click Secure Login</span>
                    </div>
                  </div>
                )}

                {/* PHONE OTP TAB */}
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
                              className="w-full pl-12 pr-4 py-3 bg-white/[0.04] border border-white/[0.1] focus:border-clinical-blue rounded-xl text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue/20"
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
                          <span>{loading ? 'Sending Security Code...' : 'Send Verification OTP'}</span>
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
                                className="w-10 h-12 text-center text-lg font-bold bg-white/[0.05] border border-white/[0.15] focus:border-clinical-teal rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-clinical-teal/30"
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

                        <button
                          type="button"
                          onClick={() => setOtpStep('phone')}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 block text-center w-full mt-2"
                        >
                          ← Change Phone Number
                        </button>
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
      {/* 2. SYSTEM FEATURES BENTO GRID                                 */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-8 pt-6">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clinical-teal/10 border border-clinical-teal/20 text-clinical-teal text-xs font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>Complete OPD Ecosystem</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
            Built for Patients, Doctors & Hospital Operations
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Everything needed to eliminate queue delays, inform patients, and optimize medical staff velocity.
          </p>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Feature 1: Patient Portal */}
          <TiltCard className="h-full">
            <div className="p-6 rounded-2xl bg-[#080912]/80 border border-white/[0.08] hover:border-clinical-blue/40 transition-all flex flex-col justify-between h-full group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-clinical-blue/10 border border-clinical-blue/20 text-clinical-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-display">Live Mobile Ticket Tracker</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Patients scan a QR code or check in online to track their exact token position, queue ahead count, and estimated wait times in real time on their mobile devices.
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.05] mt-4 flex items-center justify-between text-xs text-clinical-blue font-semibold">
                <span>Real-Time Updates</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Feature 2: Multilingual AI */}
          <TiltCard className="h-full">
            <div className="p-6 rounded-2xl bg-[#080912]/80 border border-white/[0.08] hover:border-purple-400/40 transition-all flex flex-col justify-between h-full group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-display">Multilingual AI Navigator</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Powered by Claude 3.5 Sonnet NLP. Communicates naturally in English, Hindi, and Gujarati to answer questions regarding room numbers, floor maps, and wait times.
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.05] mt-4 flex items-center justify-between text-xs text-purple-400 font-semibold">
                <span>English • हिंदी • ગુજરાતી</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Feature 3: 3D VR Waiting Room */}
          <TiltCard className="h-full">
            <div className="p-6 rounded-2xl bg-[#080912]/80 border border-white/[0.08] hover:border-clinical-teal/40 transition-all flex flex-col justify-between h-full group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-clinical-teal/10 border border-clinical-teal/20 text-clinical-teal flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Box className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-display">3D VR Waiting Room Lounge</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Relaxing Three.js WebGL virtual lounge experience with soothing particle visuals, ambient audio, and a live queue ticker overlay for anxious patients.
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.05] mt-4 flex items-center justify-between text-xs text-clinical-teal font-semibold">
                <span>Interactive WebGL Space</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Feature 4: Staff Operating Desk */}
          <TiltCard className="h-full">
            <div className="p-6 rounded-2xl bg-[#080912]/80 border border-white/[0.08] hover:border-amber-400/40 transition-all flex flex-col justify-between h-full group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-display">Staff Desk & Priority Queueing</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Counter management interface for doctors and registration staff. Features 1-click Call Next, Skip, Department Transfer, and Urgent Emergency Escalation.
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.05] mt-4 flex items-center justify-between text-xs text-amber-400 font-semibold">
                <span>Counter Command Center</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Feature 5: Admin Analytics */}
          <TiltCard className="h-full">
            <div className="p-6 rounded-2xl bg-[#080912]/80 border border-white/[0.08] hover:border-emerald-400/40 transition-all flex flex-col justify-between h-full group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-display">Admin Analytics & Bottlenecks</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Real-time KPI metrics dashboard with interactive Recharts. Detects department queue bottlenecks and triggers automated delay mitigation warnings.
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.05] mt-4 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span>Predictive KPI Engine</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

          {/* Feature 6: SMS & WhatsApp Worker */}
          <TiltCard className="h-full">
            <div className="p-6 rounded-2xl bg-[#080912]/80 border border-white/[0.08] hover:border-rose-400/40 transition-all flex flex-col justify-between h-full group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bell className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white font-display">Twilio Multi-Channel Dispatcher</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Background queue worker sends automated SMS and WhatsApp messages to patients when their turn is next, preventing missed turn calls.
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.05] mt-4 flex items-center justify-between text-xs text-rose-400 font-semibold">
                <span>SMS & WhatsApp Dispatch</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </TiltCard>

        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. STEP-BY-STEP OPD JOURNEY WORKFLOW                          */}
      {/* ------------------------------------------------------------- */}
      <section className="p-8 sm:p-12 rounded-3xl bg-[#080912]/90 border border-white/[0.08] relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
              How Curaa Transforms the OPD Journey
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">Step-by-step patient pathway from arrival to prescription collection</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
            
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-clinical-blue/20 text-clinical-blue font-bold text-xs flex items-center justify-center mx-auto border border-clinical-blue/30">
                1
              </div>
              <div className="text-xs font-bold text-white">1. QR Check-In</div>
              <div className="text-[11px] text-zinc-400">Scan QR on arrival or register on mobile</div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-clinical-teal/20 text-clinical-teal font-bold text-xs flex items-center justify-center mx-auto border border-clinical-teal/30">
                2
              </div>
              <div className="text-xs font-bold text-white">2. Token Issued</div>
              <div className="text-[11px] text-zinc-400">Receive dynamic ticket (e.g. REG-101)</div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center mx-auto border border-purple-500/30">
                3
              </div>
              <div className="text-xs font-bold text-white">3. Multilingual AI</div>
              <div className="text-[11px] text-zinc-400">Ask room directions & wait estimates</div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center mx-auto border border-amber-500/30">
                4
              </div>
              <div className="text-xs font-bold text-white">4. 3D Relaxation</div>
              <div className="text-[11px] text-zinc-400">Unwind in the WebGL 3D lounge</div>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center mx-auto border border-emerald-500/30">
                5
              </div>
              <div className="text-xs font-bold text-white">5. Doctor Call</div>
              <div className="text-[11px] text-zinc-400">Get SMS alert & proceed to counter</div>
            </div>

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. FOOTER CALL-TO-ACTION                                      */}
      {/* ------------------------------------------------------------- */}
      <section className="text-center py-10 space-y-6">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
          Ready to Experience Modern Hospital OPD Logistics?
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {!isAuthenticated && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="py-3.5 px-8 rounded-2xl bg-gradient-to-r from-clinical-blue via-clinical-teal to-purple-400 text-zinc-950 font-black text-sm shadow-[0_0_25px_rgba(56,189,248,0.4)] hover:scale-105 transition-transform cursor-pointer"
            >
              Sign In to Enter Main Website
            </button>
          )}

          <Link
            to="/check-in"
            className="py-3.5 px-8 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-white font-bold text-sm transition-all flex items-center gap-2"
          >
            <span>Go to Patient Check-In</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </PageTransition>
  );
}
