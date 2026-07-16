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
    blue: 'bg-clinical-blue border-clinical-blue text-white',
    teal: 'bg-clinical-teal border-clinical-teal text-white',
    purple: 'bg-clinical-purple border-clinical-purple text-white',
    emerald: 'bg-clinical-emerald border-clinical-emerald text-white',
    rose: 'bg-clinical-rose border-clinical-rose text-white'
  };

  const bgBorderMap: Record<string, string> = {
    blue: 'bg-sky-50 border-sky-100 text-sky-800',
    teal: 'bg-teal-50 border-teal-100 text-teal-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    rose: 'bg-rose-50 border-rose-100 text-rose-800'
  };

  const deptColor = tokenData.departments.color_code;

  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-4 py-6 flex flex-col justify-between relative">
      
      {/* 1. Graceful Connection Status Bar */}
      {connStatus !== 'connected' && (
        <div className="mb-4 bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Connection weak. Falling back to automatic sync...</span>
          </div>
          <button onClick={() => fetchData(true)} className="p-1 text-amber-800 hover:bg-amber-100 rounded">
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
            className="mb-4 bg-brand-600 border border-brand-500 p-4 rounded-xl text-white shadow-lg flex items-start justify-between gap-3"
          >
            <div className="flex gap-2">
              <Bot className="w-5 h-5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-90">Queue Announcement</h4>
                <p className="text-xs font-medium mt-0.5">{activeAlert}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveAlert(null)}
              className="text-white/80 hover:text-white text-xs font-bold"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Patient Name Welcome Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient Portal</span>
          <h2 className="text-xl font-bold text-slate-800">{tokenData.patients.name}</h2>
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2 rounded-full border transition-all duration-150 ${
            !isMuted 
              ? 'bg-brand-50 border-brand-200 text-brand-700' 
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}
          title={isMuted ? 'Unmute voice announcements' : 'Mute announcements'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 4. CLINICAL SEQUENCE MAP (Step Tracker) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 clinical-shadow">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">OPD Clinical Pathway</h3>
        
        {/* Horizontal Line Step Tracker */}
        <div className="relative flex items-center justify-between mt-2 mb-2 px-1">
          {/* Background line */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-100 -z-1"></div>
          
          {/* Active progress color bar */}
          <div 
            className="absolute left-6 top-4 h-0.5 bg-brand-500 transition-all duration-300 -z-1"
            style={{ width: `${(Math.max(0, currentStepIndex) / (DEPT_ORDER.length - 1)) * 90}%` }}
          ></div>

          {DEPT_ORDER.map((dept, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            
            // Check matching token status in history
            const histToken = visitHistory.find(h => h.departments.name.toLowerCase().includes(dept.toLowerCase().split(' ')[0]));
            const isSkipped = histToken?.status === 'skipped';
            const isDone = histToken?.status === 'completed' || isCompleted;

            let circleColor = 'bg-white border-slate-200 text-slate-400';
            if (isDone) circleColor = 'bg-emerald-500 border-emerald-500 text-white';
            else if (isSkipped) circleColor = 'bg-rose-500 border-rose-500 text-white';
            else if (isActive) circleColor = colorMap[deptColor] || 'bg-brand-600 border-brand-600 text-white';

            return (
              <div key={dept} className="flex flex-col items-center shrink-0 w-12 text-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 ${circleColor}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-[9px] font-bold mt-1.5 leading-tight truncate w-14 ${
                  isActive ? 'text-slate-800 font-extrabold' : 'text-slate-400'
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
            className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center clinical-shadow mb-5"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-emerald-900 mb-1">OPD Visit Completed!</h2>
            <p className="text-xs text-emerald-700 leading-relaxed mb-4">
              Thank you for visiting City General Hospital. All your queue tickets have been processed.
            </p>
            <div className="bg-white/80 rounded-xl p-4 border border-emerald-100 text-left text-xs text-slate-600 space-y-2">
              <h4 className="font-bold text-slate-800 mb-1">Visit Summary</h4>
              <div className="flex justify-between">
                <span>Total Departments Visited:</span>
                <span className="font-semibold text-slate-900">{visitHistory.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-in Time:</span>
                <span className="font-semibold text-slate-900">{new Date(visitHistory[0]?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Pharmacy Complete:</span>
                <span className="font-semibold text-slate-900">{new Date(tokenData.completed_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="queue-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 clinical-shadow mb-5"
          >
            {/* Header: Department Code Badge */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Station</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${bgBorderMap[deptColor] || 'bg-slate-100 text-slate-700'}`}>
                    {currentDeptName}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Floor {tokenData.departments.floor}, {tokenData.departments.room_number}
                  </span>
                </div>
              </div>
              
              {/* Token status tag */}
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize ${
                tokenData.status === 'called' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                tokenData.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                'bg-slate-100 text-slate-600'
              }`}>
                {tokenData.status}
              </span>
            </div>

            {/* Central Queue Info */}
            <div className="grid grid-cols-2 gap-4 text-center my-4">
              
              {/* Your Token */}
              <div className="border-r border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your Token</p>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none">
                  {tokenData.token_number}
                </h1>
                {tokenData.is_urgent && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded">
                    Urgent Priority
                  </span>
                )}
              </div>

              {/* Serving Now */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Serving Now</p>
                <h1 className="text-4xl font-extrabold text-brand-600 tracking-tight leading-none">
                  {currentServingToken}
                </h1>
              </div>

            </div>

            {/* Bottom Row Stats */}
            <div className="bg-slate-50 rounded-2xl p-4 mt-6 grid grid-cols-2 gap-4 border border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Patients Ahead</p>
                  <p className="text-base font-bold text-slate-800">{patientsAhead}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Est. Wait Time</p>
                  <p className="text-base font-bold text-slate-800">{estimatedWait} min</p>
                </div>
              </div>
            </div>

            {/* Bottleneck Warning Banner */}
            {tokenData.departments.is_bottleneck && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 items-start text-xs text-amber-800 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900 block">Department Delay Alert</span>
                  A temporary bottleneck has been flagged in this department. We apologize for the wait. The AI guide can assist with estimates.
                </div>
              </div>
            )}

            {/* Directions / Next step hint */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900 font-semibold">
              <span>Directions: Go to Floor {tokenData.departments.floor}, {tokenData.departments.room_number}</span>
              <ArrowRight className="w-4 h-4" />
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
          className="w-14 h-14 bg-clinical-blue hover:bg-brand-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow cursor-pointer relative"
        >
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">
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
            className="fixed inset-x-4 bottom-4 md:absolute md:inset-auto md:right-6 md:bottom-24 md:w-96 h-[500px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Chat Header */}
            <div className="bg-brand-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <div>
                  <h4 className="text-sm font-bold">Hospital Guide AI</h4>
                  <p className="text-[10px] text-brand-200 font-semibold">Queue & Logistics Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="text-white/80 hover:text-white text-xs font-bold px-2 py-1 rounded hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {chatHistory.map((chat, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                    chat.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                  }`}>
                    {chat.text}
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2 rounded-bl-none">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestion Prompts */}
            <div className="p-2 border-t border-slate-100 bg-white flex flex-wrap gap-1">
              <button
                onClick={() => handleSendMessage('Where do I go now?')}
                className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md transition-colors"
              >
                Where do I go?
              </button>
              <button
                onClick={() => handleSendMessage('How much longer to wait?')}
                className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md transition-colors"
              >
                How much longer?
              </button>
              <button
                onClick={() => handleSendMessage('मुझे कहाँ जाना है?')}
                className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md transition-colors"
              >
                कहाँ जाना है?
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask in English, Hindi, or Gujarati..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
              />
              <button
                onClick={() => handleSendMessage()}
                className="p-2 bg-clinical-blue text-white rounded-lg hover:bg-brand-700 transition-colors"
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
