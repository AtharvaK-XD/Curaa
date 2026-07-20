import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050508]">
        <RefreshCw className="w-8 h-8 text-clinical-blue animate-spin mb-4" />
        <p className="text-zinc-500 font-semibold text-xs uppercase tracking-widest">Verifying Security Session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page and store current location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
export default ProtectedRoute;
