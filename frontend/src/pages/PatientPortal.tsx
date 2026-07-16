import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Bot, Send, Clock, User, ArrowRight, CheckCircle2, 
  AlertTriangle, RefreshCw, Volume2, VolumeX, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Department clinical order and metadata
const DEPT_ORDER = ['Registration', 'Billing', 'Lab', 'OPD Room 12', 'Pharmacy'];

interface TokenInfo {
  id: string;
  token_number: string;
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'skipped';
  is_urgent: boolean;
  department_id: string;
  patient_id: string;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  departments: {
    id: string;
    name: string;
    floor: number;
    room_number: string;
    color_code: string;
    avg_service_time_minutes: number;
    is_bottleneck: boolean;
  };
  patients: {
    id: string;
    name: string;
    phone: string;
    preferred_language: 'en' | 'hi' | 'gu';
  };
}

export default function PatientPortal() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const isDemo = !tokenId || tokenId === 'demo';

  // State
  const [tokenData, setTokenData] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connStatus, setConnStatus] = useState<'connected' | 'reconnecting' | 'polling'>('connected');
  
  // Queue stats
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [currentServingToken, setCurrentServingToken] = useState<string | null>(null);
  const [visitHistory, setVisitHistory] = useState<any[]>([]);

  // AI Chat Widget
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'agent'; text: string }>>([
    { sender: 'agent', text: 'Hello! I am your hospital guide. Ask me "Where do I go now?" or "How much longer?" in English, Hindi, or Gujarati.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Audio Speech synthesis state
  const [isMuted, setIsMuted] = useState(true);

  // In-app Notification Banner
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  // Chat scroll anchor
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Data
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let targetId = tokenId;
      
      // Demo Mode Defaulting
      if (isDemo) {
        // Query database for the latest created token to demo, or fallback to mock
        const { data: latestTokens, error: lError } = await supabase
          .from('tokens')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (lError || !latestTokens || latestTokens.length === 0) {
          throw new Error('No tokens in database. Please run check-in first.');
        }
        targetId = latestTokens[0].id;
      }

      // Fetch Patient Token & Department Details
      const { data: token, error: tokenErr } = await supabase
        .from('tokens')
        .select(`
          *,
          departments (*),
          patients (*)
        `)
        .eq('id', targetId)
        .single();

      if (tokenErr || !token) throw tokenErr || new Error('Token not found');
      
      const typedToken = token as unknown as TokenInfo;
      setTokenData(typedToken);
      setError('');

      // Fetch all tokens for this patient to compile visit history
      const { data: history } = await supabase
        .from('tokens')
        .select('*, departments(*)')
        .eq('patient_id', typedToken.patient_id)
        .order('created_at', { ascending: true });
      if (history) setVisitHistory(history);

      // Fetch queue details of the current department
      const { data: deptTokensData, error: deptError } = await supabase
        .from('tokens')
        .select('id, token_number, status, created_at, is_urgent')
        .eq('department_id', typedToken.department_id)
        .in('status', ['waiting', 'called', 'in_progress'])
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: true });

      if (deptError) throw deptError;

      // Calculate patients ahead
      const index = deptTokensData.findIndex(t => t.id === targetId);
      const ahead = index >= 0 ? index : 0;
      setPatientsAhead(ahead);

      // Fetch current token being served in this department (status = called/in_progress)
      const serving = deptTokensData.find(t => t.status === 'called' || t.status === 'in_progress');
      setCurrentServingToken(serving ? serving.token_number : 'None');

      // Fetch latest pending alerts to show in-app toasts
      const { data: alerts } = await supabase
        .from('alerts_log')
        .select('message')
        .eq('token_id', targetId)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false })
        .limit(1);

      if (alerts && alerts.length > 0) {
        setActiveAlert(alerts[0].message);
        triggerVoiceAlert(alerts[0].message);
        // Mark as sent so we don't display repeatedly
        await supabase
          .from('alerts_log')
          .update({ status: 'sent' })
          .eq('token_id', targetId)
          .eq('status', 'pending');
      }

    } catch (err: any) {
      console.error('Error fetching portal data:', err);
      setError(err.message || 'Server connection error');
      setConnStatus('polling');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Text to speech voice announcer
  const triggerVoiceAlert = (text: string) => {
    if (isMuted) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      // Try to match preferred language
      const lang = tokenData?.patients?.preferred_language || 'en';
      if (lang === 'hi') utterance.lang = 'hi-IN';
      else if (lang === 'gu') utterance.lang = 'gu-IN';
      else utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Text-to-speech error:', err);
    }
  };

  // Realtime Subscription
  useEffect(() => {
    fetchData();

    // Subscribe to changes on tokens table
    const subscription = supabase
      .channel('portal-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          console.log('Realtime change received:', payload);
          fetchData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts_log' },
        (payload) => {
          if (tokenData && payload.new.token_id === tokenData.id) {
            fetchData(true);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('connected');
        } else {
          setConnStatus('polling');
        }
      });

    // Polling fallback (runs every 5 seconds for robust connection reliability)
    const pollInterval = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [tokenId, tokenData?.id]);

  // Scroll to bottom of chat when history changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatOpen]);

  // Handle AI Question Submit
  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || chatMessage;
    if (!textToSend.trim() || !tokenData) return;

    const userMsg = textToSend.trim();
    if (!customMessage) setChatMessage('');
    
    // Add to local history
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: tokenData.id,
          message: userMsg
        })
      });

      if (!res.ok) throw new Error('AI responder failed');
      const data = await res.json();
      
      setChatHistory(prev => [...prev, { sender: 'agent', text: data.response }]);
      triggerVoiceAlert(data.response);
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatHistory(prev => [
        ...prev,
        { sender: 'agent', text: 'Sorry, I am facing connectivity issues. Please try again or ask the floor staff.' }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-clinical-blue animate-spin mb-4" />
        <p className="text-slate-500 font-semibold text-sm">Loading live queue status...</p>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="flex-1 max-w-md mx-auto w-full p-6 flex flex-col justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center clinical-shadow">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Active Token Found</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            We couldn't retrieve an active queue token. It might have been completed, or you need to check in first.
          </p>
          <Link
            to="/"
            className="w-full bg-clinical-blue hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-lg transition-all duration-150 inline-block text-sm"
          >
            Go to Check-in Desk
          </Link>
        </div>
      </div>
    );
  }

  // Find step completion status
  const currentDeptName = tokenData.departments.name;
  const currentStepIndex = DEPT_ORDER.findIndex(d => currentDeptName.toLowerCase().includes(d.toLowerCase().split(' ')[0]));
  const isTokenFinished = tokenData.status === 'completed' && currentDeptName === 'Pharmacy';

  // Estimate wait time
  const estimatedWait = patientsAhead * tokenData.departments.avg_service_time_minutes;

  // Department Color Maps
  const colorMap: Record<string, string> = {
    blue: 'bg-clinical-blue border-clinical-blue text-zinc-950 shadow-[0_0_8px_rgba(56,189,248,0.35)]',
    teal: 'bg-clinical-teal border-clinical-teal text-zinc-950 shadow-[0_0_8px_rgba(45,212,191,0.35)]',
    purple: 'bg-clinical-purple border-clinical-purple text-zinc-950 shadow-[0_0_8px_rgba(167,139,250,0.35)]',
    emerald: 'bg-clinical-emerald border-clinical-emerald text-zinc-950 shadow-[0_0_8px_rgba(52,211,153,0.35)]',
    rose: 'bg-clinical-rose border-clinical-rose text-zinc-950 shadow-[0_0_8px_rgba(251,113,133,0.35)]'
  };

  const bgBorderMap: Record<string, string> = {
    blue: 'bg-sky-950/40 border border-sky-850/60 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.1)]',
    teal: 'bg-teal-950/40 border border-teal-850/60 text-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.1)]',
    purple: 'bg-purple-950/40 border border-purple-850/60 text-purple-300 shadow-[0_0_8px_rgba(167,139,250,0.1)]',
    emerald: 'bg-emerald-950/40 border border-emerald-850/60 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.1)]',
    rose: 'bg-rose-950/40 border border-rose-850/60 text-rose-300 shadow-[0_0_8px_rgba(251,113,133,0.1)]'
  };

  const deptColor = tokenData.departments.color_code;

  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-4 py-6 flex flex-col justify-between relative text-zinc-100">
      
      {/* 1. Graceful Connection Status Bar */}
      {connStatus !== 'connected' && (
        <div className="mb-4 bg-amber-950/20 border-l-4 border-amber-500 border border-amber-900/50 p-3 rounded-r-lg flex items-center justify-between shadow-xs text-amber-350">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse text-amber-500" />
            <span>Connection weak. Using background polling mode...</span>
          </div>
          <button onClick={() => fetchData(true)} className="p-1 hover:bg-amber-950/50 rounded">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. In-App Notification Toast Alert */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-zinc-100 shadow-xl flex items-start justify-between gap-3 shadow-[0_0_15px_rgba(56,189,248,0.12)]"
          >
            <div className="flex gap-2">
              <Bot className="w-5 h-5 shrink-0 text-clinical-blue" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-clinical-blue">Queue Announcement</h4>
                <p className="text-xs font-medium mt-0.5">{activeAlert}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveAlert(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-bold px-2 py-1 rounded"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Patient Name Welcome Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Patient Portal</span>
          <h2 className="text-xl font-bold text-zinc-200">{tokenData.patients.name}</h2>
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2 rounded-full border transition-all duration-150 cursor-pointer ${
            !isMuted 
              ? 'bg-clinical-blue/20 border-clinical-blue/30 text-clinical-blue shadow-[0_0_10px_rgba(56,189,248,0.25)]' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
          title={isMuted ? 'Unmute voice announcements' : 'Mute announcements'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 4. CLINICAL SEQUENCE MAP (Step Tracker) */}
      <div className="glass-panel rounded-2xl p-4 mb-5 clinical-shadow border border-zinc-800/80 card-3d">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">OPD Clinical Pathway</h3>
        
        {/* Horizontal Line Step Tracker */}
        <div className="relative flex items-center justify-between mt-2 mb-2 px-1">
          {/* Background line */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-zinc-950 -z-1"></div>
          
          {/* Active progress color bar */}
          <div 
            className="absolute left-6 top-4 h-0.5 bg-clinical-blue/80 transition-all duration-300 -z-1 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
            style={{ width: `${(Math.max(0, currentStepIndex) / (DEPT_ORDER.length - 1)) * 90}%` }}
          ></div>

          {DEPT_ORDER.map((dept, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            
            // Check matching token status in history
            const histToken = visitHistory.find(h => h.departments.name.toLowerCase().includes(dept.toLowerCase().split(' ')[0]));
            const isSkipped = histToken?.status === 'skipped';
            const isDone = histToken?.status === 'completed' || isCompleted;

            let circleColor = 'bg-zinc-950 border-zinc-855 text-zinc-650';
            if (isDone) circleColor = 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-[0_0_8px_rgba(16,185,129,0.35)]';
            else if (isSkipped) circleColor = 'bg-rose-500 border-rose-500 text-zinc-950 shadow-[0_0_8px_rgba(239,68,68,0.35)]';
            else if (isActive) circleColor = colorMap[deptColor] || 'bg-brand-600 border-brand-600 text-zinc-950';

            return (
              <div key={dept} className="flex flex-col items-center shrink-0 w-12 text-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 ${circleColor}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4 text-zinc-950" /> : idx + 1}
                </div>
                <span className={`text-[9px] font-bold mt-1.5 leading-tight truncate w-14 ${
                  isActive ? 'text-zinc-200 font-extrabold' : 'text-zinc-500'
                }`}>
                  {dept.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. LIVE TOKEN STATUS CARD */}
      <AnimatePresence mode="wait">
        {isTokenFinished ? (
          <motion.div
            key="finished-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-emerald-950/15 border border-emerald-900/50 rounded-2xl p-6 text-center clinical-shadow mb-5 text-emerald-400"
          >
            <CheckCircle2 className="w-12 h-12 text-clinical-emerald mx-auto mb-3 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
            <h2 className="text-xl font-bold text-zinc-100 mb-1">OPD Visit Completed!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Thank you for visiting City General Hospital. All your queue tickets have been processed.
            </p>
            <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-800 text-left text-xs text-zinc-300 space-y-2">
              <h4 className="font-bold text-zinc-200 mb-1">Visit Summary</h4>
              <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                <span>Total Departments Visited:</span>
                <span className="font-semibold text-zinc-100">{visitHistory.length}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-1.5">
                <span>Check-in Time:</span>
                <span className="font-semibold text-zinc-100">{new Date(visitHistory[0]?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Pharmacy Complete:</span>
                <span className="font-semibold text-zinc-100">{new Date(tokenData.completed_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="queue-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel rounded-3xl border border-zinc-800/80 p-6 clinical-shadow mb-5 card-3d"
          >
            {/* Header: Department Code Badge */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Station</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${bgBorderMap[deptColor] || 'bg-zinc-900 text-zinc-300'}`}>
                    {currentDeptName}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold">
                    Floor {tokenData.departments.floor}, {tokenData.departments.room_number}
                  </span>
                </div>
              </div>
              
              {/* Token status tag */}
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize ${
                tokenData.status === 'called' ? 'bg-amber-950/40 border border-amber-900/50 text-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.15)]' :
                tokenData.status === 'in_progress' ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-400' :
                'bg-zinc-900 border border-zinc-800 text-zinc-400'
              }`}>
                {tokenData.status}
              </span>
            </div>

            {/* Central Queue Info - 3D Inset Well */}
            <div className="bg-zinc-950/90 border border-zinc-900 shadow-inner rounded-2xl py-6 my-4 grid grid-cols-2 gap-4 text-center">
              
              {/* Your Token */}
              <div className="border-r border-zinc-900 flex flex-col justify-center items-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Your Token</p>
                <h1 className="text-5xl font-extrabold text-zinc-100 tracking-tight leading-none depth-3d-text">
                  {tokenData.token_number}
                </h1>
                {tokenData.is_urgent && (
                  <span className="inline-block mt-2.5 px-2 py-0.5 bg-rose-950/40 border border-rose-900/60 text-rose-400 text-[10px] font-bold rounded uppercase">
                    Urgent
                  </span>
                )}
              </div>

              {/* Serving Now */}
              <div className="flex flex-col justify-center items-center">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Serving Now</p>
                <h1 className="text-5xl font-extrabold text-clinical-teal tracking-tight leading-none depth-3d-text filter drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]">
                  {currentServingToken}
                </h1>
              </div>

            </div>

            {/* Bottom Row Stats */}
            <div className="bg-zinc-900/40 rounded-2xl p-4 mt-6 grid grid-cols-2 gap-4 border border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-950/40 text-sky-400 border border-sky-900/50 flex items-center justify-center shrink-0 shadow-inner">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider leading-tight">Patients Ahead</p>
                  <p className="text-base font-bold text-zinc-200">{patientsAhead}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-900/50 flex items-center justify-center shrink-0 shadow-inner">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider leading-tight">Est. Wait Time</p>
                  <p className="text-base font-bold text-zinc-200">{estimatedWait} min</p>
                </div>
              </div>
            </div>

            {/* Bottleneck Warning Banner */}
            {tokenData.departments.is_bottleneck && (
              <div className="mt-4 p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl flex gap-2 items-start text-xs text-amber-400 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300 block">Department Delay Alert</span>
                  A temporary bottleneck has been flagged in this department. We apologize for the wait. The AI guide can assist with estimates.
                </div>
              </div>
            )}

            {/* Directions / Next step hint */}
            <div className="mt-4 p-3 bg-sky-950/20 border border-sky-900/50 rounded-xl flex items-center justify-between text-xs text-sky-400 font-semibold shadow-inner">
              <span>Directions: Go to Floor {tokenData.departments.floor}, {tokenData.departments.room_number}</span>
              <ArrowRight className="w-4 h-4 text-sky-400" />
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. FLOATING AI ASSISTANT TRIGGER BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setChatOpen(true)}
          className="w-14 h-14 bg-clinical-blue hover:bg-sky-400 text-zinc-950 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:shadow-[0_0_22px_rgba(56,189,248,0.6)] transition-shadow cursor-pointer relative btn-3d"
        >
          <Bot className="w-6 h-6 text-zinc-950" />
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse shadow-sm">
            AI
          </span>
        </motion.button>
      </div>

      {/* 7. CHAT WIDGET MODAL */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-4 bottom-4 md:absolute md:inset-auto md:right-6 md:bottom-24 md:w-96 h-[500px] bg-zinc-900 border border-zinc-800/80 rounded-2xl shadow-2xl shadow-black/85 flex flex-col z-50 overflow-hidden"
          >
            {/* Chat Header */}
            <div className="bg-zinc-950 text-white p-4 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-clinical-blue" />
                <div>
                  <h4 className="text-sm font-bold">Hospital Guide AI</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Queue & Logistics Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="text-zinc-550 hover:text-zinc-350 text-xs font-bold px-2 py-1 rounded hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-950">
              {chatHistory.map((chat, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                    chat.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-br-none shadow-md shadow-brand-700/10'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none shadow-sm'
                  }`}>
                    {chat.text}
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-500 flex items-center gap-2 rounded-bl-none">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestion Prompts */}
            <div className="p-2 border-t border-zinc-800 bg-zinc-900 flex flex-wrap gap-1">
              <button
                onClick={() => handleSendMessage('Where do I go now?')}
                className="text-[10px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Where do I go?
              </button>
              <button
                onClick={() => handleSendMessage('How much longer to wait?')}
                className="text-[10px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                How much longer?
              </button>
              <button
                onClick={() => handleSendMessage('मुझे कहाँ जाना है?')}
                className="text-[10px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800/80 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                कहाँ जाना है?
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-900 flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask in English, Hindi, or Gujarati..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-clinical-blue focus:border-clinical-blue text-xs"
              />
              <button
                onClick={() => handleSendMessage()}
                className="p-2 bg-clinical-blue hover:bg-sky-400 text-zinc-950 rounded-lg transition-colors cursor-pointer font-bold shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
