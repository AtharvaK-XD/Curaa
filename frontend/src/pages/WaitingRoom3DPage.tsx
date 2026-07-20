import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { mockDatabase } from '../lib/mockDatabase';
import WaitingRoom3DCanvas from '../components/WaitingRoom3DCanvas';
import { 
  Clock, User, AlertTriangle, ShieldAlert, Globe, ArrowLeft, MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';

// Translations Dictionary (English, Hindi, Gujarati)
const i18n = {
  en: {
    title: "3D Virtual Hospital Lounge",
    subtitle: "Real-time 3D OPD Waiting Lounge & Spatial Navigator",
    serving: "Serving Now",
    yourToken: "Your Token",
    patientsAhead: "Patients Ahead",
    estWaitTime: "Est. Wait Time",
    minutes: "mins",
    station: "Station Location",
    floor: "Floor",
    emergencyBtn: "Shift to Emergency Room (CRITICAL)",
    emergencyActiveTitle: "EMERGENCY TRIAGE ACTIVATED",
    emergencyActiveSub: "Patient shifted to Emergency Trauma Bay 1. Medical team dispatched.",
    emergencyUndo: "Return to Regular OPD Queue",
    languageLabel: "Language",
    roomStatus: "3D Lounge Status",
    liveWaitMsg: "Please remain seated in the virtual lounge. You will be alerted when called.",
    roomName: "OPD Waiting Lounge B"
  },
  hi: {
    title: "3D वर्चुअल अस्पताल लाउंज",
    subtitle: "लाइव 3D ओपीडी प्रतीक्षा क्षेत्र और नेविगेशन",
    serving: "वर्तमान टोकन",
    yourToken: "आपका टोकन",
    patientsAhead: "आपसे आगे मरीज",
    estWaitTime: "अनुमानित प्रतीक्षा समय",
    minutes: "मिनट",
    station: "स्टेशन स्थान",
    floor: "मंजिल",
    emergencyBtn: "आपातकालीन कक्ष में स्थानांतरण (क्रिटिकल)",
    emergencyActiveTitle: "आपातकालीन ट्रॉमा बे सक्रिय",
    emergencyActiveSub: "मरीज को तुरंत आपातकालीन ट्रॉमा बे 1 में स्थानांतरित कर दिया गया है। मेडिकल टीम को सूचित कर दिया गया है।",
    emergencyUndo: "सामान्य ओपीडी कतार में वापस लौटें",
    languageLabel: "भाषा",
    roomStatus: "3D लाउंज स्थिति",
    liveWaitMsg: "कृपया वर्चुअल लाउंज में प्रतीक्षा करें। आपका नंबर आने पर सूचित किया जाएगा।",
    roomName: "ओपीडी प्रतीक्षालय बी"
  },
  gu: {
    title: "3D વર્ચ્યુઅલ હોસ્પિટલ લાઉન્જ",
    subtitle: "લાઇવ 3D OPD પ્રતીક્ષા વિસ્તાર અને નેવિગેશન",
    serving: "હાલનો ટોકન",
    yourToken: "તમારો ટોકન",
    patientsAhead: "તમારી આગળ દર્દીઓ",
    estWaitTime: "અંદાજિત પ્રતીક્ષા સમય",
    minutes: "મિનિટ",
    station: "સ્ટેશન સ્થાન",
    floor: "માળ",
    emergencyBtn: "ઇમરજન્સી રૂમમાં શિફ્ટ કરો (ક્રિટિકલ)",
    emergencyActiveTitle: "ઇમરજન્સી ટ્રોમા બે સક્રિય",
    emergencyActiveSub: "દર્દીને તરત જ ઇમરજન્સી ટ્રોમા બે 1 પર શિફ્ટ કરવામાં આવ્યા છે. મેડિકલ ટીમને જાણ કરવામાં આવી છે.",
    emergencyUndo: "સામાન્ય OPD કતારમાં પાછા જાઓ",
    languageLabel: "ભાષા",
    roomStatus: "3D લાઉન્જ સ્થિતિ",
    liveWaitMsg: "કૃપા કરીને વર્ચ્યુઅલ લાઉન્જમાં રાહ જુઓ. જ્યારે નંબર આવશે ત્યારે તમને જાણ કરવામાં આવશે.",
    roomName: "OPD વેઇટિંગ લાઉન્જ B"
  }
};

export default function WaitingRoom3DPage() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const isDemo = !tokenId || tokenId === 'demo';

  // Language state: 'en' | 'hi' | 'gu'
  const [language, setLanguage] = useState<'en' | 'hi' | 'gu'>('en');

  // Token & Queue states
  const [tokenData, setTokenData] = useState<any>(null);
  const [patientsAhead, setPatientsAhead] = useState(2);
  const [servingToken, setServingToken] = useState('OPD-102');
  const [totalWaiting, setTotalWaiting] = useState(5);

  // Emergency Mode state
  const [isEmergency, setIsEmergency] = useState(false);

  // Fetch Token details
  const fetchTokenInfo = async () => {
    if (!isSupabaseConfigured) {
      let targetId = tokenId;
      if (isDemo || !targetId) {
        const all = mockDatabase.getTokens();
        if (all.length > 0) targetId = all[all.length - 1].id;
      }
      if (targetId) {
        const data = mockDatabase.getToken(targetId);
        if (data) {
          setTokenData(data);
          const queue = mockDatabase.getDepartmentQueue(data.department_id);
          const waiting = queue.filter(t => ['waiting', 'called'].includes(t.status));
          const idx = waiting.findIndex(t => t.id === targetId);
          setPatientsAhead(idx >= 0 ? idx : 1);
          setTotalWaiting(Math.max(4, waiting.length));
          const serving = waiting.find(t => t.status === 'called');
          if (serving) setServingToken(serving.token_number);
          if (data.is_urgent) setIsEmergency(true);
        }
      }
      return;
    }

    try {
      let targetId = tokenId;
      if (isDemo) {
        const { data: latest } = await supabase.from('tokens').select('id').order('created_at', { ascending: false }).limit(1);
        if (latest && latest.length > 0) targetId = latest[0].id;
      }

      if (targetId) {
        const { data } = await supabase.from('tokens').select('*, departments(*), patients(*)').eq('id', targetId).single();
        if (data) {
          setTokenData(data);
          if (data.patients?.preferred_language) {
            setLanguage(data.patients.preferred_language as any);
          }
          if (data.is_urgent) setIsEmergency(true);

          const { data: deptTokens } = await supabase
            .from('tokens')
            .select('id, token_number, status')
            .eq('department_id', data.department_id)
            .in('status', ['waiting', 'called', 'in_progress']);
          
          if (deptTokens) {
            const idx = deptTokens.findIndex(t => t.id === targetId);
            setPatientsAhead(idx >= 0 ? idx : 1);
            setTotalWaiting(Math.max(4, deptTokens.length));
            const active = deptTokens.find(t => t.status === 'called');
            if (active) setServingToken(active.token_number);
          }
        }
      }
    } catch (err) {
      console.error('Error loading 3D waiting room info:', err);
    }
  };

  useEffect(() => {
    fetchTokenInfo();
    const interval = setInterval(fetchTokenInfo, 4000);
    return () => clearInterval(interval);
  }, [tokenId]);

  // Handle Shift to Emergency Room
  const handleToggleEmergency = async () => {
    const nextEmergency = !isEmergency;
    setIsEmergency(nextEmergency);

    if (tokenData) {
      if (!isSupabaseConfigured) {
        mockDatabase.toggleUrgent(tokenData.id);
      } else {
        try {
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/staff/toggle-urgent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId: tokenData.id })
          });
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Audio Voice Announcement for Emergency Triage
    if (nextEmergency) {
      try {
        const msg = language === 'hi'
          ? "आपातकालीन ट्रॉमा बे सक्रिय। मरीज को ट्रॉमा बे 1 में स्थानांतरित किया जा रहा है।"
          : language === 'gu'
          ? "ઇમરજન્સી ટ્રોમા બે સક્રિય. દર્દીને ટ્રોમા બે 1 માં શિફ્ટ કરવામાં આવી રહ્યા છે."
          : "Emergency Trauma Bay activated. Shifting patient to Emergency Bay 1 immediately.";
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-US';
        window.speechSynthesis.speak(utterance);
      } catch (err) {}
    }
  };

  const t = i18n[language];
  const avgTimePerPatient = tokenData?.departments?.avg_service_time_minutes || 5;
  const estimatedWaitMins = patientsAhead * avgTimePerPatient;
  const tokenNum = tokenData?.token_number || 'TKN-101';
  const deptName = tokenData?.departments?.name || 'OPD Room 12';
  const roomNum = tokenData?.departments?.room_number || 'Room 305';
  const floorNum = tokenData?.departments?.floor || 3;

  // Camera Preset View state: 'orbit' | 'user' | 'doctor' | 'emergency'
  const [cameraView, setCameraView] = useState<'orbit' | 'user' | 'doctor' | 'emergency'>('orbit');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex-1 max-w-[1800px] mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex flex-col justify-between text-zinc-100 overflow-x-hidden"
    >
      
      {/* 1. Header Navigation Bar & Language Selector Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={tokenId ? `/patient/${tokenId}` : '/patient/demo'}
            className="p-2.5 bg-[#0a0a10] border border-white/[0.06] hover:bg-white/[0.04] text-zinc-400 rounded-xl transition-all shrink-0"
            title="Back to Patient Portal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-clinical-blue uppercase tracking-widest bg-clinical-blue/10 border border-clinical-blue/20 px-2 py-0.5 rounded">
                Spatial VR Engine
              </span>
              <span className="text-xs text-zinc-550 font-medium font-display">&bull; {t.roomName}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-150 font-display mt-0.5">{t.title}</h2>
          </div>
        </div>

        {/* Language Selector Buttons (English / Hindi / Gujarati) */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#0a0a10] p-1.5 rounded-2xl border border-white/[0.06] shadow-inner overflow-x-auto max-w-full no-scrollbar">
          <Globe className="w-4 h-4 text-clinical-teal ml-1.5 mr-0.5 shrink-0" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-1 shrink-0">{t.languageLabel}:</span>
          
          <button
            onClick={() => setLanguage('en')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              language === 'en'
                ? 'bg-clinical-blue text-zinc-950 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            English
          </button>

          <button
            onClick={() => setLanguage('hi')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              language === 'hi'
                ? 'bg-clinical-teal text-zinc-950 shadow-[0_0_12px_rgba(45,212,191,0.3)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            हिंदी
          </button>

          <button
            onClick={() => setLanguage('gu')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              language === 'gu'
                ? 'bg-clinical-purple text-zinc-950 shadow-[0_0_12px_rgba(167,139,250,0.3)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ગુજરાતી
          </button>
        </div>
      </div>

      {/* 2. Main 3D Canvas & Side HUD Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch flex-1">
        
        {/* LEFT / CENTER: Three.js 3D Interactive Virtual Waiting Room (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3 sm:space-y-4">
          
          {/* Camera View Mode Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[#0a0a10] border border-white/[0.05] p-2.5 sm:px-4 sm:py-2.5 rounded-2xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">3D Camera View Angle:</span>
            
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => setCameraView('orbit')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  cameraView === 'orbit'
                    ? 'bg-clinical-blue text-zinc-950 shadow-md'
                    : 'bg-[#050508] text-zinc-400 border border-white/[0.05] hover:text-zinc-200'
                }`}
              >
                🎥 Orbit View
              </button>

              <button
                onClick={() => setCameraView('user')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  cameraView === 'user'
                    ? 'bg-clinical-teal text-zinc-950 shadow-md'
                    : 'bg-[#050508] text-zinc-400 border border-white/[0.05] hover:text-zinc-200'
                }`}
              >
                👤 Focus On Me
              </button>

              <button
                onClick={() => setCameraView('doctor')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  cameraView === 'doctor'
                    ? 'bg-sky-500 text-zinc-950 shadow-md'
                    : 'bg-[#050508] text-zinc-400 border border-white/[0.05] hover:text-zinc-200'
                }`}
              >
                🚪 Doctor Desk
              </button>

              <button
                onClick={() => setCameraView('emergency')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  cameraView === 'emergency'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-[#050508] text-zinc-400 border border-white/[0.05] hover:text-zinc-200'
                }`}
              >
                🚨 Emergency Bay
              </button>
            </div>
          </div>

          <div className="flex-1 h-[360px] sm:h-[480px] lg:h-[540px] min-h-[320px]">
            <WaitingRoom3DCanvas
              queuePosition={patientsAhead}
              totalWaiting={totalWaiting}
              userTokenNumber={tokenNum}
              servingTokenNumber={servingToken}
              isEmergency={isEmergency}
              cameraView={cameraView}
            />
          </div>
        </div>

        {/* RIGHT: Live Patient Telemetry & Emergency Controls HUD (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4 sm:space-y-6">
          
          {/* Active Token & ETA HUD Card */}
          <div className="glass-panel border border-white/[0.05] rounded-3xl p-4 sm:p-6 clinical-shadow card-3d space-y-4 sm:space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{t.yourToken}</span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight depth-3d-text font-display mt-0.5">
                  {tokenNum}
                </h1>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{t.serving}</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-clinical-teal font-display filter drop-shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                  {servingToken}
                </h2>
              </div>
            </div>

            {/* Patients Ahead & Dynamic ETA Countdown */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-[#050508] border border-white/[0.05] p-3 sm:p-4 rounded-2xl">
                <div className="flex items-center gap-2 text-clinical-blue mb-1">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{t.patientsAhead}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-150 font-display">{patientsAhead}</h3>
              </div>

              <div className="bg-[#050508] border border-white/[0.05] p-3 sm:p-4 rounded-2xl">
                <div className="flex items-center gap-2 text-clinical-rose mb-1">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{t.estWaitTime}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-150 font-display">
                  ~{estimatedWaitMins} <span className="text-xs text-zinc-500 font-semibold">{t.minutes}</span>
                </h3>
              </div>
            </div>

            {/* Department & Floor Information */}
            <div className="bg-[#08080c] border border-white/[0.04] p-3.5 sm:p-4 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-clinical-teal shrink-0" />
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">{t.station}</span>
                  <span className="font-bold text-zinc-200">{deptName}</span>
                </div>
              </div>

              <span className="px-2.5 py-1 bg-clinical-teal/10 border border-clinical-teal/20 text-clinical-teal text-[10px] font-bold rounded-lg shrink-0">
                {t.floor} {floorNum}, {roomNum}
              </span>
            </div>

            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed italic text-center">
              "{t.liveWaitMsg}"
            </p>
          </div>

          {/* CRITICAL EMERGENCY ROOM FAST-TRACK SWITCH */}
          <div className={`rounded-3xl p-4 sm:p-6 border transition-all duration-300 ${
            isEmergency 
              ? 'bg-rose-500/15 border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.25)]' 
              : 'glass-panel border-white/[0.05]'
          }`}>
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${isEmergency ? 'bg-rose-500 text-zinc-950 animate-bounce' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wider ${isEmergency ? 'text-rose-400' : 'text-zinc-200'}`}>
                  {isEmergency ? t.emergencyActiveTitle : 'Emergency Fast-Track Triage'}
                </h3>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 leading-relaxed">
                  {isEmergency ? t.emergencyActiveSub : 'Critical condition requiring immediate ICU / Trauma Bay transfer.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleEmergency}
              className={`w-full py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-widest font-display btn-3d cursor-pointer ${
                isEmergency
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
              }`}
            >
              <AlertTriangle className="w-4 h-4 fill-current shrink-0" />
              <span>{isEmergency ? t.emergencyUndo : t.emergencyBtn}</span>
            </button>
          </div>

        </div>

      </div>

    </motion.div>
  );
}
