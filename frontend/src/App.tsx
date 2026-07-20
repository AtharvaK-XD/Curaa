import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import PatientCheckIn from './pages/PatientCheckIn';
import PatientPortal from './pages/PatientPortal';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WaitingRoom3DPage from './pages/WaitingRoom3DPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Activity, LayoutDashboard, UserCheck, Users, Cpu, LogOut, User as UserIcon, LogIn, Box } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';

function DemoNavBar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  
  // Highlight active link
  const linkClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 shrink-0 whitespace-nowrap ${
      isActive 
        ? 'bg-clinical-blue text-zinc-950 font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[1.02]' 
        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
    }`;
  };

  return (
    <div className="bg-[#050508]/90 border-b border-white/[0.04] py-2.5 sm:py-3.5 px-3 sm:px-6 sticky top-0 z-50 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      <div className="max-w-[1800px] w-full mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        
        {/* Brand Logo & Sync Mode */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img 
              src="/favicon.svg" 
              alt="Curaa Logo" 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.25)] object-cover shrink-0" 
            />
            <div>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-1.5 font-display">
                Curaa <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold tracking-widest uppercase">OPD Logix</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-zinc-500 font-medium">City General Hospital</p>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-2">
            {isSupabaseConfigured ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Sync</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                <Cpu className="w-3 h-3 text-amber-500 animate-pulse" />
                <span>Demo</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation Link Pills - Horizontal Scrollable on Mobile */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-[#0a0a10] p-1 rounded-2xl border border-white/[0.06] shadow-inner overflow-x-auto max-w-full no-scrollbar">
          <Link to="/" className={linkClass('/')}>
            <UserCheck className="w-3.5 h-3.5" />
            <span>Check-in</span>
          </Link>
          <Link to="/patient/demo" className={linkClass('/patient')}>
            <Activity className="w-3.5 h-3.5" />
            <span>Patient Portal</span>
          </Link>
          <Link to="/waiting-room" className={linkClass('/waiting-room')}>
            <Box className="w-3.5 h-3.5 text-clinical-teal animate-pulse" />
            <span>3D VR Lounge</span>
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

        {/* Desktop Sync Mode & User Session Controls */}
        <div className="flex items-center justify-between md:justify-end gap-3 text-xs font-semibold">
          <div className="hidden md:flex items-center gap-3">
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

          {/* User Account / Auth Control Badge */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 pl-0 md:pl-3 border-l-0 md:border-l border-white/[0.08] w-full md:w-auto justify-end">
              <div className="flex items-center gap-2 bg-[#0a0a10] border border-white/[0.06] py-1 px-2.5 rounded-xl">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-clinical-blue/20 text-clinical-blue flex items-center justify-center text-xs font-bold">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
                <span className="text-xs font-semibold text-zinc-300 truncate max-w-[100px] sm:max-w-[120px]">{user.name}</span>
              </div>

              <button
                onClick={logout}
                className="p-2 text-zinc-400 hover:text-rose-400 bg-[#0a0a10] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/20 rounded-xl transition-all cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold shadow-md btn-3d text-xs ml-auto md:ml-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-[#050508] text-zinc-100">
          <DemoNavBar />
          
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col">
            <Routes>
              {/* Public Authentication Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes (Requires Login) */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <PatientCheckIn />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patient/:tokenId" 
                element={
                  <ProtectedRoute>
                    <PatientPortal />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patient/demo" 
                element={
                  <ProtectedRoute>
                    <PatientPortal />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/waiting-room" 
                element={
                  <ProtectedRoute>
                    <WaitingRoom3DPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/waiting-room/:tokenId" 
                element={
                  <ProtectedRoute>
                    <WaitingRoom3DPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/staff" 
                element={
                  <ProtectedRoute>
                    <StaffDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
          
          <footer className="bg-[#08080c] border-t border-white/[0.04] py-4 sm:py-5 text-center text-xs text-zinc-650 font-medium px-4">
            &copy; {new Date().getFullYear()} Curaa. Hospital OPD Logistics Engine. Dynamic Queue Navigator.
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
