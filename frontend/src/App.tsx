import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PatientCheckIn from './pages/PatientCheckIn';
import PatientPortal from './pages/PatientPortal';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WaitingRoom3DPage from './pages/WaitingRoom3DPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AmbientBackground from './components/AmbientBackground';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Activity, LayoutDashboard, UserCheck, Users, Cpu, LogOut, User as UserIcon, LogIn, Box } from 'lucide-react';
import { isSupabaseConfigured } from './lib/supabaseClient';

const navItems = [
  { path: '/', label: 'Check-in', icon: UserCheck },
  { path: '/patient/demo', matchPrefix: '/patient', label: 'Patient Portal', icon: Activity },
  { path: '/waiting-room', label: '3D VR Lounge', icon: Box, extraIconClass: 'text-clinical-teal animate-pulse' },
  { path: '/staff', label: 'Staff Desk', icon: Users },
  { path: '/admin', label: 'Admin KPI', icon: LayoutDashboard },
];

function DemoNavBar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="bg-[#050508]/85 border-b border-white/[0.05] py-2.5 sm:py-3.5 px-3 sm:px-6 sticky top-0 z-50 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="max-w-[1800px] w-full mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        
        {/* Brand Logo & Sync Mode */}
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.08, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <img 
                src="/favicon.svg" 
                alt="Curaa Logo" 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.35)] object-cover shrink-0 border border-white/10" 
              />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clinical-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-clinical-blue"></span>
              </span>
            </motion.div>

            <div>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-1.5 font-display group-hover:text-clinical-blue transition-colors">
                Curaa <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold tracking-widest uppercase bg-zinc-900/80 px-1.5 py-0.5 rounded border border-white/[0.06]">OPD Logix</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-zinc-500 font-medium">City General Hospital</p>
            </div>
          </Link>

          <div className="flex md:hidden items-center gap-2">
            {isSupabaseConfigured ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Sync</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                <Cpu className="w-3 h-3 text-amber-500 animate-pulse" />
                <span>Demo Mode</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation Link Pills with Motion layoutId Active Indicator */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-[#090a12]/90 p-1.5 rounded-2xl border border-white/[0.07] shadow-inner overflow-x-auto max-w-full no-scrollbar relative">
          {navItems.map((item) => {
            const isActive = item.matchPrefix 
              ? location.pathname.startsWith(item.matchPrefix)
              : location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors shrink-0 whitespace-nowrap z-10 select-none"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavTab"
                    className="absolute inset-0 bg-gradient-to-r from-clinical-blue to-clinical-teal rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.35)] -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950 font-bold' : item.extraIconClass || 'text-zinc-400'}`} />
                <span className={isActive ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-100 transition-colors'}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Desktop Sync Mode & User Session Controls */}
        <div className="flex items-center justify-between md:justify-end gap-3 text-xs font-semibold">
          <div className="hidden md:flex items-center gap-3">
            {isSupabaseConfigured ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Cloud Sync</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.12)]">
                <Cpu className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span>Offline Demo Mode</span>
              </div>
            )}
          </div>

          {/* User Account / Auth Control Badge */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 pl-0 md:pl-3 border-l-0 md:border-l border-white/[0.08] w-full md:w-auto justify-end">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-2 bg-[#090a12] border border-white/[0.08] py-1 px-2.5 rounded-xl shadow-sm"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-clinical-blue/30" />
                ) : (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-clinical-blue/20 text-clinical-blue flex items-center justify-center text-xs font-bold border border-clinical-blue/30">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
                <span className="text-xs font-semibold text-zinc-200 truncate max-w-[100px] sm:max-w-[120px]">{user.name}</span>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={logout}
                className="p-2 text-zinc-400 hover:text-rose-400 bg-[#090a12] hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/20 rounded-xl transition-all cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          ) : (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="ml-auto md:ml-0">
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-clinical-blue to-clinical-teal text-zinc-950 font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)] btn-3d text-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function MainContent() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-[#050508] text-zinc-100 relative overflow-hidden">
          {/* Ambient Motion Orbs & Dot Grid Background */}
          <AmbientBackground />
          
          <DemoNavBar />
          
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col relative z-10">
            <MainContent />
          </main>
          
          <footer className="bg-[#08080c]/80 border-t border-white/[0.04] py-4 sm:py-5 text-center text-xs text-zinc-500 font-medium px-4 backdrop-blur-md relative z-10">
            &copy; {new Date().getFullYear()} Curaa. Hospital OPD Logistics Engine. Dynamic Queue Navigator.
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

