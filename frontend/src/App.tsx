import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import PatientCheckIn from './pages/PatientCheckIn';
import PatientPortal from './pages/PatientPortal';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Activity, LayoutDashboard, UserCheck, Users, Cpu } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';

function DemoNavBar() {
  const location = useLocation();
  
  // Highlight active link
  const linkClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 ${
      isActive 
        ? 'bg-clinical-blue text-zinc-950 font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[1.02]' 
        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
    }`;
  };

  return (
    <div className="bg-[#050508]/80 border-b border-white/[0.04] py-3.5 px-6 sticky top-0 z-50 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <img 
            src="/favicon.svg" 
            alt="Curaa Logo" 
            className="w-9 h-9 rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.25)] object-cover" 
          />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
              Curaa <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">OPD Logix</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium">City General Hospital</p>
          </div>
        </div>
        
        {/* Navigation Link Pills */}
        <div className="flex items-center gap-1.5 bg-[#0a0a10] p-1 rounded-2xl border border-white/[0.06] shadow-inner">
          <Link to="/" className={linkClass('/')}>
            <UserCheck className="w-3.5 h-3.5" />
            <span>Check-in</span>
          </Link>
          <Link to="/patient/demo" className={linkClass('/patient')}>
            <Activity className="w-3.5 h-3.5" />
            <span>Patient Portal</span>
          </Link>
          <Link to="/staff" className={linkClass('/staff')}>
            <Users className="w-3.5 h-3.5" />
            <span>Staff Desk</span>
          </Link>
          <Link to="/admin" className={linkClass('/admin')}>
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Admin KPI</span>
          </Link>
        </div>

        {/* Sync Mode Status Badge */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {isSupabaseConfigured ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.08)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Cloud Sync</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.08)]">
              <Cpu className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Offline Demo Mode</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#050508] text-zinc-100">
        <DemoNavBar />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<PatientCheckIn />} />
            <Route path="/patient/:tokenId" element={<PatientPortal />} />
            {/* Fallback helper for when tokenId is omitted in dev navbar */}
            <Route path="/patient/demo" element={<PatientPortal />} />
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
        
        <footer className="bg-[#08080c] border-t border-white/[0.04] py-5 text-center text-xs text-zinc-650 font-medium">
          &copy; {new Date().getFullYear()} Curaa. Hospital OPD Logistics Engine. Dynamic Queue Navigator.
        </footer>
      </div>
    </Router>
  );
}

export default App;

