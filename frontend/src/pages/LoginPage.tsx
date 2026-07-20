import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Phone, ArrowRight, ShieldCheck, Lock, CheckCircle2, 
  Sparkles, KeyRound, Smartphone, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const { loginWithGoogle, sendPhoneOtp, verifyPhoneOtp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Target redirect path after login
  const from = (location.state as any)?.from?.pathname || '/';

  // State
  const [authMethod, setAuthMethod] = useState<'google' | 'phone'>('google');
  
  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Handle Google Login
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      setSuccessMsg('Google Login Successful! Redirecting...');
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Google authentication failed. Please try again.');
      setLoading(false);
    }
  };

  // Handle Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await sendPhoneOtp(fullPhone);
      setOtpStep('otp');
      setSuccessMsg(`OTP sent to ${fullPhone}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Try demo OTP verification.');
      // Proceed to OTP step for demo
      setOtpStep('otp');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Digit Input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next field
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle OTP Keydown (Backspace)
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const success = await verifyPhoneOtp(fullPhone, otpCode);
      if (success) {
        setSuccessMsg('Phone Authentication Verified! Logging in...');
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 600);
      } else {
        setError('Invalid OTP code. Please enter 6 digits (e.g. 123456).');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed. Use code 123456 for demo.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col justify-center text-zinc-100">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Hospital Branding & Access Lock Info */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 bg-gradient-to-br from-[#0b0c16] to-[#05060d] rounded-3xl p-8 text-white flex flex-col justify-between border border-white/[0.05] card-3d clinical-shadow"
        >
          <div>
            <div className="inline-flex items-center justify-center p-3 bg-clinical-blue/10 border border-clinical-blue/20 rounded-2xl mb-6 shadow-inner depth-3d-element">
              <Lock className="w-7 h-7 text-clinical-blue animate-pulse" />
            </div>
            
            <span className="text-[9px] font-bold text-clinical-blue uppercase tracking-widest bg-clinical-blue/10 border border-clinical-blue/20 px-2.5 py-1 rounded-md">
              Secure OPD Gateway
            </span>

            <h2 className="text-2xl font-bold tracking-tight mt-3 mb-3 depth-3d-text text-zinc-100 font-display">
              Authentication <br />Required
            </h2>
            <p className="text-zinc-400 text-xs leading-relaxed mb-8">
              Sign in to unlock full access to Curaa Hospital Services, live queue tracking, patient portals, staff desk, and admin analytics.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-[#08080c] p-3 rounded-2xl border border-white/[0.04]">
                <div className="w-8 h-8 rounded-xl bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center text-clinical-teal shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">HIPAA Compliant Security</h4>
                  <p className="text-[10px] text-zinc-550">End-to-end encrypted session identity.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#08080c] p-3 rounded-2xl border border-white/[0.04]">
                <div className="w-8 h-8 rounded-xl bg-clinical-purple/10 border border-clinical-purple/20 flex items-center justify-center text-clinical-purple shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">Single Sign-On (SSO)</h4>
                  <p className="text-[10px] text-zinc-550">Instant authentication via Google or Phone OTP.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.04] flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
            <Lock className="w-3.5 h-3.5 text-zinc-650" />
            <span>Authorized access only. City General Hospital OPD Logix.</span>
          </div>
        </motion.div>

        {/* Right Side: Auth Selector Card (Google & Phone Options) */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 bg-[#0a0a10]/80 backdrop-blur-xl rounded-3xl p-8 border border-white/[0.05] clinical-shadow flex flex-col justify-between"
        >
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-zinc-100 font-display">Sign In to Curaa</h3>
              <p className="text-xs text-zinc-500 mt-1">Choose your preferred login method below to proceed.</p>
            </div>

            {/* Auth Method Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-[#050508] p-1.5 rounded-2xl border border-white/[0.06] mb-8">
              <button
                onClick={() => { setAuthMethod('google'); setError(''); setSuccessMsg(''); }}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  authMethod === 'google'
                    ? 'bg-clinical-blue text-zinc-950 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google Sign In</span>
              </button>

              <button
                onClick={() => { setAuthMethod('phone'); setError(''); setSuccessMsg(''); }}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  authMethod === 'phone'
                    ? 'bg-clinical-teal text-zinc-950 shadow-[0_0_15px_rgba(45,212,191,0.3)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Phone OTP Login</span>
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-rose-500/10 border-l-2 border-rose-500 rounded-r-xl text-rose-350 text-xs font-semibold leading-relaxed border border-rose-500/20 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-450 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Success Alert */}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-emerald-500/10 border-l-2 border-emerald-500 rounded-r-xl text-emerald-350 text-xs font-semibold leading-relaxed border border-emerald-500/20 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-450 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* OPTION 1: GOOGLE LOGIN PANEL */}
            {authMethod === 'google' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center py-6"
              >
                <div className="p-8 bg-[#050508] border border-white/[0.04] rounded-3xl space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-white shadow-inner">
                    <svg className="w-8 h-8" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  
                  <h4 className="text-sm font-bold text-zinc-200">Google Workspace & Personal SSO</h4>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                    Fast, passwordless sign-in with your Google account. Secure token validation.
                  </p>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-wider btn-3d cursor-pointer font-display mt-4"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    ) : (
                      <>
                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* OPTION 2: PHONE NUMBER LOGIN PANEL */}
            {authMethod === 'phone' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <AnimatePresence mode="wait">
                  {otpStep === 'phone' ? (
                    <form key="phone-form" onSubmit={handleSendOtp} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-550 uppercase tracking-widest mb-2">Mobile Phone Number</label>
                        <div className="flex gap-2">
                          <div className="px-3.5 py-2.5 bg-[#050508] border border-white/[0.08] rounded-xl text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                            <span>🇮🇳 +91</span>
                          </div>
                          <input
                            type="tel"
                            placeholder="98765 43210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-200 placeholder-zinc-700 neon-input focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || phone.length < 10}
                        className="w-full bg-gradient-to-r from-clinical-teal to-teal-400 text-zinc-950 font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest btn-3d cursor-pointer mt-4 font-display disabled:opacity-40"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                        ) : (
                          <>
                            <Phone className="w-4 h-4 text-zinc-950" />
                            <span>Send Verification Code (OTP)</span>
                            <ArrowRight className="w-4 h-4 text-zinc-950" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form key="otp-form" onSubmit={handleVerifyOtp} className="space-y-6">
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-clinical-teal uppercase tracking-widest bg-clinical-teal/10 border border-clinical-teal/20 px-2.5 py-0.5 rounded">
                          Enter 6-Digit Code
                        </span>
                        <p className="text-xs text-zinc-400 mt-2">
                          OTP sent to <span className="font-bold text-zinc-200">+91 {phone}</span>
                        </p>
                        
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold">
                          <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                          <span>Demo Test OTP: 123456</span>
                        </div>
                      </div>

                      {/* 6-Digit Box Inputs */}
                      <div className="flex justify-center gap-2 my-4">
                        {otp.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`otp-input-${idx}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            className="w-11 h-13 text-center text-lg font-bold text-zinc-100 bg-[#050508] border border-white/[0.08] rounded-xl focus:border-clinical-teal focus:shadow-[0_0_12px_rgba(45,212,191,0.25)] focus:outline-none transition-all font-display"
                          />
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setOtpStep('phone')}
                          className="px-4 py-3 bg-[#050508] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Back
                        </button>

                        <button
                          type="submit"
                          disabled={loading || otp.join('').length < 6}
                          className="flex-1 bg-gradient-to-r from-clinical-teal to-teal-400 text-zinc-950 font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest btn-3d cursor-pointer font-display disabled:opacity-40"
                        >
                          {loading ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                          ) : (
                            <>
                              <KeyRound className="w-4 h-4 text-zinc-950" />
                              <span>Verify & Access System</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          <div className="mt-8 pt-5 border-t border-white/[0.04] text-center text-[10px] text-zinc-650 font-semibold">
            <span>Hospital Logistics Engine &bull; Protected Access Controls &bull; v1.2.0</span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
