import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { mockDatabase } from '../lib/mockDatabase';
import { 
  Bot, Send, Clock, User, ArrowRight, CheckCircle2, 
  AlertTriangle, RefreshCw, Volume2, VolumeX, AlertCircle, MapPin, Sparkles, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  const [connStatus, setConnStatus] = useState<'connected' | 'reconnecting' | 'polling' | 'offline'>('connected');
  
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

    if (!isSupabaseConfigured) {
      // Offline mock query logic
      try {
        let targetId = tokenId;
        if (isDemo || !targetId) {
          const all = mockDatabase.getTokens();
          if (all.length === 0) throw new Error('No local tokens found. Please check in first.');
          targetId = all[all.length - 1].id;
        }

        const tData = mockDatabase.getToken(targetId);
        if (!tData) throw new Error('Token not found in local storage.');

        setTokenData(tData as unknown as TokenInfo);
        setError('');
        setConnStatus('offline');

        // History
        const hist = mockDatabase.getPatientTokens(tData.patient_id);
        setVisitHistory(hist);

        // Department Queue Waiting
        const queue = mockDatabase.getDepartmentQueue(tData.department_id);
        const activeQueue = queue.filter(t => ['waiting', 'called', 'in_progress'].includes(t.status));
        const index = activeQueue.findIndex(t => t.id === targetId);
        setPatientsAhead(index >= 0 ? index : 0);

        const serving = activeQueue.find(t => ['called', 'in_progress'].includes(t.status));
        setCurrentServingToken(serving ? serving.token_number : 'None');

        // Check alerts
        const alerts = mockDatabase.getAlertsForToken(targetId);
        const pendingAlert = alerts.find(a => a.status === 'pending');
        if (pendingAlert) {
          setActiveAlert(pendingAlert.message);
          triggerVoiceAlert(pendingAlert.message);
          mockDatabase.clearAlertsForToken(targetId);
        }

      } catch (err: any) {
        console.error('Error fetching mock portal data:', err);
        setError(err.message || 'Offline data load error');
      } finally {
        if (!silent) setLoading(false);
      }
      return;
    }

    // Online Supabase logic
    try {
      let targetId = tokenId;
      
      if (isDemo) {
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

      const { data: history } = await supabase
        .from('tokens')
        .select('*, departments(*)')
        .eq('patient_id', typedToken.patient_id)
        .order('created_at', { ascending: true });
      if (history) setVisitHistory(history);

      const { data: deptTokensData, error: deptError } = await supabase
        .from('tokens')
        .select('id, token_number, status, created_at, is_urgent')
        .eq('department_id', typedToken.department_id)
        .in('status', ['waiting', 'called', 'in_progress'])
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: true });

      if (deptError) throw deptError;

      const index = deptTokensData.findIndex(t => t.id === targetId);
      setPatientsAhead(index >= 0 ? index : 0);

      const serving = deptTokensData.find(t => t.status === 'called' || t.status === 'in_progress');
      setCurrentServingToken(serving ? serving.token_number : 'None');

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
        
        await supabase
          .from('alerts_log')
          .update({ status: 'sent' })
          .eq('token_id', targetId)
          .eq('status', 'pending');
      }

    } catch (err: any) {
      console.error('Error fetching portal data:', err);
      setConnStatus('polling');
      try {
        let fallbackId = tokenId;
        if (isDemo || !fallbackId) {
          const all = mockDatabase.getTokens();
          if (all.length > 0) fallbackId = all[all.length - 1].id;
        }
        if (fallbackId) {
          const tData = mockDatabase.getToken(fallbackId);
          if (tData) {
            setTokenData(tData as unknown as TokenInfo);
            const hist = mockDatabase.getPatientTokens(tData.patient_id);
            setVisitHistory(hist);
            setError('');
          }
        }
      } catch (fallbackErr) {
        setError(err.message || 'Server connection error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const triggerVoiceAlert = (text: string) => {
    if (isMuted) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      const lang = tokenData?.patients?.preferred_language || 'en';
      if (lang === 'hi') utterance.lang = 'hi-IN';
      else if (lang === 'gu') utterance.lang = 'gu-IN';
      else utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Text-to-speech error:', err);
    }
  };

  useEffect(() => {
    fetchData();

    if (isSupabaseConfigured) {
      const subscription = supabase
        .channel('portal-live-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tokens' },
          () => {
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

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [tokenId, tokenData?.id]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchData(true);
    }, isSupabaseConfigured ? 5000 : 2000);

    return () => clearInterval(pollInterval);
  }, [tokenId, tokenData?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatOpen]);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || chatMessage;
    if (!textToSend.trim() || !tokenData) return;

    const userMsg = textToSend.trim();
    if (!customMessage) setChatMessage('');
    
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatLoading(true);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        const lowercaseMsg = userMsg.toLowerCase();
        let reply = '';
        let lang: 'en' | 'hi' | 'gu' = 'en';
        if (/कहाँ|समय|कब|मेरा|डॉक्टर|दवाई|कैसे|नमस्ते/.test(userMsg)) {
          lang = 'hi';
        } else if (/ક્યાં|સમય|ક્યારે|મારો|દવા|કેવી|નમસ્તે/.test(userMsg)) {
          lang = 'gu';
        } else {
          lang = tokenData.patients?.preferred_language || 'en';
        }

        const medicalKeywords = [
          'pain', 'fever', 'headache', 'medicine', 'prescription', 'cough', 'sick', 'diagnose', 'symptom', 'disease', 'cure',
          'दर्द', 'बुखार', 'सिरदर्द', 'दवा', 'बीमार', 'खांसी', 'इलाज', 'लक्षण',
          'દુખાવો', 'તાવ', 'માથું', 'દવા', 'બીમાર', 'ખાંસી', 'ઈલાજ', 'લક્ષણો'
        ];
        
        if (medicalKeywords.some(kw => lowercaseMsg.includes(kw))) {
          if (lang === 'hi') {
            reply = `मैं एक कतार सहायक हूँ और चिकित्सा या नुस्खे की सलाह नहीं दे सकता। कृपया अपने डॉक्टर से सीधे बात करें।`;
          } else if (lang === 'gu') {
            reply = `હું કતાર સહાયક છું અને તબીબી અથવા પ્રિસ્ક્રિપ્શન સલાહ આપી શકતો નથી. કૃપા કરીને ડૉક્ટર સાથે સીધી વાત કરો.`;
          } else {
            reply = `I am a queue assistant and cannot provide medical or diagnostic advice. Please consult your doctor directly.`;
          }
        } else if (/where|go|room|floor|counter|location|कहाँ|कमरा|मंजिल|स्थान|काउंटर|जाना|ક્યાં|રૂમ|માળ|સ્થાન|કાઉન્ટર|જવું/.test(lowercaseMsg)) {
          if (lang === 'hi') {
            reply = `नमस्ते ${tokenData.patients.name}! आपको ${tokenData.departments.name} पर जाना है, जो मंजिल ${tokenData.departments.floor}, ${tokenData.departments.room_number} पर स्थित है।`;
          } else if (lang === 'gu') {
            reply = `નમસ્તે ${tokenData.patients.name}! તમારે ${tokenData.departments.name} માં જવાનું છે, જે માળ ${tokenData.departments.floor}, ${tokenData.departments.room_number} પર આવેલ છે.`;
          } else {
            reply = `Hi ${tokenData.patients.name}! Please proceed to ${tokenData.departments.name}, situated on Floor ${tokenData.departments.floor}, at ${tokenData.departments.room_number}.`;
          }
        } else if (/long|wait|time|position|queue|when|समय|कब|इंतजार|कतार|नंबर|देरी|સમય|ક્યારે|રાહ|કતાર|નંબર|વિલંબ/.test(lowercaseMsg)) {
          const wait = patientsAhead * tokenData.departments.avg_service_time_minutes;
          if (lang === 'hi') {
            reply = `आपके टोकन ${tokenData.token_number} के आगे ${patientsAhead} मरीज हैं। अनुमानित प्रतीक्षा समय लगभग ${wait} मिनट है।`;
          } else if (lang === 'gu') {
            reply = `તમારા ટોકન ${tokenData.token_number} ની આગળ ${patientsAhead} દર્દીઓ છે. અંદાજિત પ્રતીક્ષા સમય લગભગ ${wait} મિનિટ છે.`;
          } else {
            reply = `Your token is ${tokenData.token_number}. There are ${patientsAhead} patients ahead of you. The estimated wait is ${wait} minutes.`;
          }
        } else {
          if (lang === 'hi') {
            reply = `नमस्ते! मैं आपका अस्पताल मार्गदर्शक हूँ। आप मुझसे कतार स्थान या प्रतीक्षा समय पूछ सकते हैं।`;
          } else if (lang === 'gu') {
            reply = `નમસ્તે! હું તમારો હોસ્પિટલ ગાઇડ છું. તમે મને કતારના સ્થાન અથવા પ્રતીક્ષા સમય વિશે પૂછી શકો છો.`;
          } else {
            reply = `Hello! I am your hospital guide. Feel free to ask about your queue status, station room number, or estimated wait time.`;
          }
        }

        setChatHistory(prev => [...prev, { sender: 'agent', text: reply }]);
        setChatLoading(false);
        triggerVoiceAlert(reply);
      }, 600);
      return;
    }

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
        <RefreshCw className="w-9 h-9 text-clinical-blue animate-spin mb-4" />
        <p className="text-zinc-550 font-semibold text-xs uppercase tracking-widest">Loading Live OPD Feed...</p>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="flex-1 max-w-md mx-auto w-full p-6 flex flex-col justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-[#0a0a10] rounded-3xl border border-white/[0.05] p-8 text-center clinical-shadow"
        >
          <AlertCircle className="w-12 h-12 text-rose-450 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-zinc-200 mb-2 font-display">No Active Ticket Found</h3>
          <p className="text-xs text-zinc-550 mb-6 leading-relaxed">
            We couldn't retrieve an active queue ticket. Ensure you have checked in at the entry desk to receive a tracking link.
          </p>
          <Link
            to="/"
            className="w-full bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold py-2.5 px-4 rounded-xl transition-all duration-200 inline-block text-xs uppercase tracking-wider btn-3d"
          >
            Go to Check-in Desk
          </Link>
        </motion.div>
      </div>
    );
  }

  const currentDeptName = tokenData.departments.name;
  const currentStepIndex = DEPT_ORDER.findIndex(d => currentDeptName.toLowerCase().includes(d.toLowerCase().split(' ')[0]));
  const isTokenFinished = tokenData.status === 'completed' && currentDeptName === 'Pharmacy';
  const estimatedWait = patientsAhead * tokenData.departments.avg_service_time_minutes;

  const colorMap: Record<string, string> = {
    blue: 'bg-clinical-blue border-clinical-blue text-zinc-950 shadow-[0_0_15px_rgba(56,189,248,0.45)]',
    teal: 'bg-clinical-teal border-clinical-teal text-zinc-950 shadow-[0_0_15px_rgba(45,212,191,0.45)]',
    purple: 'bg-clinical-purple border-clinical-purple text-zinc-950 shadow-[0_0_15px_rgba(167,139,250,0.45)]',
    emerald: 'bg-clinical-emerald border-clinical-emerald text-zinc-950 shadow-[0_0_15px_rgba(52,211,153,0.45)]',
    rose: 'bg-clinical-rose border-clinical-rose text-zinc-950 shadow-[0_0_15px_rgba(251,113,133,0.45)]'
  };

  const badgeColorMap: Record<string, string> = {
    blue: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    teal: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400'
  };

  const deptColor = tokenData.departments.color_code;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 max-w-2xl 2xl:max-w-3xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col justify-between relative text-zinc-100"
    >
      
      {/* 1. Connection Status Toast */}
      {connStatus === 'polling' && (
        <div className="mb-4 bg-amber-500/10 border-l-2 border-amber-500 border border-amber-500/20 p-3 rounded-r-xl flex items-center justify-between text-amber-400 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse text-amber-500" />
            <span>Connection weak. Polling data stream...</span>
          </div>
          <button onClick={() => fetchData(true)} className="p-1 hover:bg-amber-500/20 rounded-lg">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Live Alerts log Toast notifications */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-5 bg-[#0e0e18] border border-white/[0.06] p-4 rounded-2xl text-zinc-200 shadow-2xl flex items-start justify-between gap-3 shadow-[0_0_20px_rgba(56,189,248,0.08)]"
          >
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-clinical-blue" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-clinical-blue font-display">OPD Announcement</h4>
                <p className="text-xs font-medium mt-1 leading-relaxed text-zinc-300">{activeAlert}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveAlert(null)}
              className="text-zinc-550 hover:text-zinc-350 p-1 hover:bg-white/[0.04] rounded-lg transition-colors shrink-0"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Welcome Patient Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest">Active Patient Profile</span>
          <h2 className="text-xl font-bold text-zinc-150 font-display mt-0.5">{tokenData.patients.name}</h2>
        </div>
        
        <button
          onClick={() => {
            const nextMuted = !isMuted;
            setIsMuted(nextMuted);
            if (!nextMuted) {
              const utterance = new SpeechSynthesisUtterance("Voice announcements enabled.");
              utterance.lang = 'en-US';
              window.speechSynthesis.speak(utterance);
            }
          }}
          className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
            !isMuted 
              ? 'bg-clinical-blue/15 border-clinical-blue/30 text-clinical-blue shadow-[0_0_12px_rgba(56,189,248,0.2)]' 
              : 'bg-[#08080c] border-white/[0.08] text-zinc-500 hover:text-zinc-350'
          }`}
          title={isMuted ? 'Unmute voice announcements' : 'Mute announcements'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 4. Horizontal subway clinical sequence tracker */}
      <div className="glass-panel rounded-3xl p-5 mb-5 clinical-shadow border border-white/[0.04] card-3d">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5">OPD Station Routing Map</h3>
        
        <div className="relative flex items-center justify-between mt-2 mb-2 px-1">
          {/* Gray track background */}
          <div className="absolute left-6 right-6 top-4 h-[3px] bg-[#0c0c14] -z-1 rounded-full"></div>
          
          {/* Active green progress fill */}
          <div 
            className="absolute left-6 top-4 h-[3px] bg-gradient-to-r from-clinical-blue to-clinical-teal transition-all duration-500 -z-1 shadow-[0_0_12px_rgba(45,212,191,0.5)] rounded-full"
            style={{ width: `${(Math.max(0, currentStepIndex) / (DEPT_ORDER.length - 1)) * 90}%` }}
          ></div>

          {DEPT_ORDER.map((dept, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            
            const histToken = visitHistory.find(h => h.departments?.name.toLowerCase().includes(dept.toLowerCase().split(' ')[0]));
            const isSkipped = histToken?.status === 'skipped';
            const isDone = histToken?.status === 'completed' || isCompleted;

            let circleStyle = 'bg-[#08080c] border-white/[0.08] text-zinc-650';
            if (isDone) {
              circleStyle = 'bg-gradient-to-br from-emerald-400 to-emerald-500 border-emerald-500 text-zinc-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.35)]';
            } else if (isSkipped) {
              circleStyle = 'bg-rose-500 border-rose-550 text-zinc-950 font-black shadow-[0_0_12px_rgba(239,68,68,0.3)]';
            } else if (isActive) {
              circleStyle = colorMap[deptColor] || 'bg-clinical-blue border-clinical-blue text-zinc-950';
            }

            return (
              <div key={dept} className="flex flex-col items-center shrink-0 w-12 text-center relative">
                {/* Ping animation behind active node */}
                {isActive && (
                  <span className="absolute top-0 w-8 h-8 rounded-full bg-clinical-blue/20 animate-ping"></span>
                )}
                <div className={`w-8 h-8 rounded-full border-[1.5px] flex items-center justify-center font-bold text-xs transition-all duration-300 ${circleStyle} font-display`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4 text-zinc-950" /> : idx + 1}
                </div>
                <span className={`text-[9px] font-bold mt-2.5 leading-tight truncate w-14 ${
                  isActive ? 'text-zinc-200 font-extrabold scale-105' : 'text-zinc-550'
                }`}>
                  {dept.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Central Live Token Ticket details */}
      <AnimatePresence mode="wait">
        {isTokenFinished ? (
          <motion.div
            key="finished-card"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', damping: 20 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 text-center clinical-shadow mb-6 text-emerald-400"
          >
            <CheckCircle2 className="w-12 h-12 text-clinical-emerald mx-auto mb-3 filter drop-shadow-[0_0_12px_rgba(52,211,153,0.35)] animate-bounce" />
            <h2 className="text-lg font-bold text-zinc-150 mb-1 font-display">Hospital Journey Completed!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-5 max-w-sm mx-auto">
              Your OPD visits have been completed. All prescriptions have been dispatched. Thank you for choosing City General Hospital.
            </p>
            <div className="bg-[#08080c] rounded-2xl p-5 border border-white/[0.04] text-left text-xs text-zinc-350 space-y-3">
              <h4 className="font-bold text-zinc-200 mb-1 font-display uppercase tracking-wider text-[10px]">Pathway Summary</h4>
              <div className="flex justify-between border-b border-white/[0.04] pb-2 text-[11px]">
                <span className="text-zinc-500">Departments Visited:</span>
                <span className="font-semibold text-zinc-200">{visitHistory.length} Stations</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-2 text-[11px]">
                <span className="text-zinc-500">Check-in Time:</span>
                <span className="font-semibold text-zinc-200">
                  {new Date(visitHistory[0]?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Completion Time:</span>
                <span className="font-semibold text-zinc-200">
                  {new Date(tokenData.completed_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="queue-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22 }}
            className="glass-panel rounded-[32px] border border-white/[0.05] p-6 clinical-shadow mb-6 card-3d"
          >
            {/* Active Station & Floor Info */}
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-4 mb-4">
              <div>
                <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest">Target Station</span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${badgeColorMap[deptColor] || 'bg-zinc-900 text-zinc-300'}`}>
                    {currentDeptName}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Floor {tokenData.departments.floor}, {tokenData.departments.room_number}</span>
                  </span>
                </div>
              </div>
              
              <span className={`px-3 py-1 text-[10px] font-bold rounded-full capitalize tracking-wider border ${
                tokenData.status === 'called' ? 'bg-amber-500/10 border-amber-500/20 text-amber-450 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.12)]' :
                tokenData.status === 'in_progress' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' :
                'bg-[#08080c] border-white/[0.08] text-zinc-400'
              }`}>
                {tokenData.status}
              </span>
            </div>

            {/* Glowing Digital Ticket Card */}
            <div className="bg-[#040406] border border-white/[0.02] shadow-inner rounded-3xl py-6 my-4 grid grid-cols-2 gap-4 text-center relative overflow-hidden">
              <div className="absolute top-[-50px] left-[-50px] w-24 h-24 bg-clinical-blue/5 rounded-full blur-2xl"></div>
              <div className="absolute bottom-[-50px] right-[-50px] w-24 h-24 bg-clinical-teal/5 rounded-full blur-2xl"></div>
              
              {/* Patient Token Ticket */}
              <div className="border-r border-white/[0.04] flex flex-col justify-center items-center py-2">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Your Queue ID</p>
                <h1 className="text-4xl font-extrabold text-zinc-100 tracking-tight leading-none depth-3d-text font-display">
                  {tokenData.token_number}
                </h1>
                {tokenData.is_urgent && (
                  <span className="inline-block mt-3 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[9px] font-bold rounded uppercase tracking-wider">
                    High Priority
                  </span>
                )}
              </div>

              {/* Serving Now ID */}
              <div className="flex flex-col justify-center items-center py-2">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Serving Now</p>
                <h1 className="text-4xl font-extrabold text-clinical-teal tracking-tight leading-none depth-3d-text filter drop-shadow-[0_0_12px_rgba(45,212,191,0.3)] font-display">
                  {currentServingToken}
                </h1>
              </div>
            </div>

            {/* Estimated Stats - With Cross fading numbers */}
            <div className="bg-[#08080c]/50 rounded-2xl p-4 mt-6 grid grid-cols-2 gap-4 border border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/5 text-sky-400 border border-sky-500/10 flex items-center justify-center shrink-0 shadow-inner">
                  <User className="w-4 h-4 text-clinical-blue" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Patients Ahead</p>
                  <div className="text-sm font-bold text-zinc-200 mt-0.5 h-5 flex overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={patientsAhead}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.22 }}
                      >
                        {patientsAhead}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/5 text-amber-400 border border-amber-500/10 flex items-center justify-center shrink-0 shadow-inner">
                  <Clock className="w-4 h-4 text-clinical-rose" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Est. Wait Time</p>
                  <div className="text-sm font-bold text-zinc-200 mt-0.5 h-5 flex overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={estimatedWait}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.22 }}
                      >
                        {estimatedWait} min
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* Delay alert banner */}
            {tokenData.departments.is_bottleneck && (
              <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 items-start text-xs text-amber-400 font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold text-amber-300 block text-[11px] uppercase tracking-wider">Station Surge Alert</span>
                  This counter is experiencing temporary equipment calibration delays. Thank you for your patience.
                </div>
              </div>
            )}

            {/* Directions hint */}
            <div className="mt-4 p-3.5 bg-[#08080c] border border-white/[0.04] rounded-2xl flex items-center justify-between text-xs text-clinical-blue font-bold shadow-inner">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-clinical-teal" />
                <span>Go to Floor {tokenData.departments.floor}, Counter {tokenData.departments.room_number}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-clinical-blue" />
            </div>

            {/* Launch 3D Virtual Lounge Button */}
            <Link
              to={tokenData ? `/waiting-room/${tokenData.id}` : '/waiting-room'}
              className="mt-3 w-full bg-gradient-to-r from-clinical-blue/20 to-clinical-teal/20 hover:from-clinical-blue/30 hover:to-clinical-teal/30 border border-clinical-blue/30 text-clinical-blue font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer font-display shadow-lg"
            >
              <Sparkles className="w-4 h-4 text-clinical-teal animate-pulse" />
              <span>Launch 3D VR Hospital Waiting Room</span>
              <ArrowRight className="w-4 h-4 text-clinical-blue" />
            </Link>

          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Floating AI Assistant Action Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.06, boxShadow: '0 0 25px rgba(56,189,248,0.5)' }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setChatOpen(true)}
          className="w-14 h-14 bg-gradient-to-br from-clinical-blue to-clinical-teal text-zinc-950 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer relative btn-3d"
        >
          <Bot className="w-5 h-5 text-zinc-950" />
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md animate-pulse">
            AI Guide
          </span>
        </motion.button>
      </div>

      {/* 7. Slide-in Chat Widget Modal */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-4 bottom-4 md:absolute md:inset-auto md:right-6 md:bottom-24 md:w-96 h-[510px] bg-[#0c0d16] border border-white/[0.06] rounded-3xl shadow-2xl shadow-black/85 flex flex-col z-50 overflow-hidden"
          >
            {/* Header bar */}
            <div className="bg-[#050508] p-4 flex items-center justify-between border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center text-clinical-blue">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 font-display">Hospital Guide AI</h4>
                  <p className="text-[9px] text-zinc-550 font-bold uppercase tracking-widest mt-0.5">Logistics & Queue Helper</p>
                </div>
              </div>
              
              <button 
                onClick={() => setChatOpen(false)}
                className="text-zinc-500 hover:text-zinc-350 p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Chat Messages - with entry list stagger animations */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#050508]">
              {chatHistory.map((chat, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 18 }}
                  key={idx} 
                  className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    chat.sender === 'user'
                      ? 'bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-medium rounded-br-none shadow-md'
                      : 'bg-[#101018] border border-white/[0.04] text-zinc-300 rounded-bl-none shadow-sm'
                  }`}>
                    {chat.text}
                  </div>
                </motion.div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#101018] border border-white/[0.04] rounded-2xl px-4 py-2.5 text-xs text-zinc-500 flex items-center gap-2 rounded-bl-none">
                    <RefreshCw className="w-3 h-3 animate-spin text-clinical-blue" />
                    <span>Analyzing queue data...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Chips Suggestion */}
            <div className="p-2 border-t border-white/[0.04] bg-[#0c0d16] flex flex-wrap gap-1">
              <button
                onClick={() => handleSendMessage('Where do I go now?')}
                className="text-[9px] font-bold bg-[#050508] hover:bg-[#12121e] text-zinc-400 border border-white/[0.04] px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Where do I go?
              </button>
              <button
                onClick={() => handleSendMessage('How much longer to wait?')}
                className="text-[9px] font-bold bg-[#050508] hover:bg-[#12121e] text-zinc-400 border border-white/[0.04] px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                How long?
              </button>
              <button
                onClick={() => handleSendMessage('मुझे कहाँ जाना है?')}
                className="text-[9px] font-bold bg-[#050508] hover:bg-[#12121e] text-zinc-400 border border-white/[0.04] px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                कहाँ जाना है?
              </button>
            </div>

            {/* Send input bar */}
            <div className="p-3 border-t border-white/[0.04] bg-[#0c0d16] flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask in English, Hindi, or Gujarati..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-[#050508] text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-clinical-blue text-xs"
              />
              <button
                onClick={() => handleSendMessage()}
                className="p-2.5 bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 rounded-xl transition-all hover:shadow-[0_0_10px_rgba(56,189,248,0.25)] cursor-pointer font-bold shadow-sm"
              >
                <Send className="w-3.5 h-3.5 text-zinc-950" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
