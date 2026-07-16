import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import PatientCheckIn from './pages/PatientCheckIn';
import PatientPortal from './pages/PatientPortal';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Activity, LayoutDashboard, UserCheck, Users } from 'lucide-react';

function DemoNavBar() {
  const location = useLocation();
  
  // Highlight active link
  const linkClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
      isActive 
        ? 'bg-brand-600 text-white shadow-sm' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  return (
    <div className="bg-white border-b border-slate-200 py-2.5 px-4 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-clinical-blue flex items-center justify-center text-white font-bold">
            H
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">City General Hospital</h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Queue Navigator</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
          <Link to="/" className={linkClass('/')}>
            <UserCheck className="w-4 h-4" />
            <span>Check-in</span>
          </Link>
          <Link to="/patient/demo" className={linkClass('/patient')}>
            <Activity className="w-4 h-4" />
            <span>Patient Portal</span>
          </Link>
          <Link to="/staff" className={linkClass('/staff')}>
            <Users className="w-4 h-4" />
            <span>Staff Desk</span>
          </Link>
          <Link to="/admin" className={linkClass('/admin')}>
            <LayoutDashboard className="w-4 h-4" />
            <span>Admin KPI</span>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live Sync Enabled</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-50">
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
        
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} Hospital Queue Navigator. Multi-Tenancy Ready OPD Logistics Engine.
        </footer>
      </div>
    </Router>
  );
}

export default App;
