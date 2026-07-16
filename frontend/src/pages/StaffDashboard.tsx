import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, UserCheck, AlertTriangle, Play, CheckCircle2, 
  UserMinus, ShieldAlert, RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Department {
  id: string;
  name: string;
  floor: number;
  room_number: string;
  avg_service_time_minutes: number;
  is_bottleneck: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  department_id: string;
  role: 'staff' | 'admin';
  departments: Department;
}

interface QueueToken {
  id: string;
  token_number: string;
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'skipped';
  is_urgent: boolean;
  created_at: string;
  patients: {
    id: string;
    name: string;
    phone: string;
    preferred_language: string;
  };
}

export default function StaffDashboard() {
  // Staff Selection state (demo simulation)
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);

  // Queue state
  const [waitingTokens, setWaitingTokens] = useState<QueueToken[]>([]);
  const [activeToken, setActiveToken] = useState<QueueToken | null>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  // Modals & Action loadings
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipTokenId, setSkipTokenId] = useState<string>('');
  const [skipReason, setSkipReason] = useState('Patient not present when called');
  
  // Load staff records
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('*, departments(*)');
        if (error) throw error;
        
        const staffRecords = data as unknown as StaffMember[];
        setStaffList(staffRecords);
        
        // Auto-select Asha Sharma (Registration) for the demo start
        const defaultStaff = staffRecords.find(s => s.name.includes('Asha'));
        if (defaultStaff) {
          setSelectedStaffId(defaultStaff.id);
          setCurrentStaff(defaultStaff);
        } else if (staffRecords.length > 0) {
          setSelectedStaffId(staffRecords[0].id);
          setCurrentStaff(staffRecords[0]);
        }
      } catch (err) {
        console.error('Error fetching staff list:', err);
      }
    };
    fetchStaff();
  }, []);

  // Fetch Queue Data for selected staff's department
  const fetchQueueData = async (silent = false) => {
    if (!currentStaff) return;
    if (!silent) setRefreshing(true);

    try {
      const deptId = currentStaff.department_id;

      // 1. Fetch Waiting Queue
      const { data: waiting, error: wError } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('department_id', deptId)
        .eq('status', 'waiting')
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: true });

      if (wError) throw wError;
      setWaitingTokens(waiting as unknown as QueueToken[]);

      // 2. Fetch Currently Called/In-Progress Patient
      const { data: active, error: aError } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('department_id', deptId)
        .in('status', ['called', 'in_progress'])
        .limit(1);

      if (aError) throw aError;
      setActiveToken(active && active.length > 0 ? (active[0] as unknown as QueueToken) : null);

      // 3. Fetch Recent completed/skipped events in this department (Audit list)
      const { data: events } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('department_id', deptId)
        .in('status', ['completed', 'skipped'])
        .order('completed_at', { ascending: false })
        .limit(5);
      
      if (events) setRecentEvents(events);

      // Refresh current staff bottleneck status
      const { data: updatedDept } = await supabase
        .from('departments')
        .select('*')
        .eq('id', deptId)
        .single();
      
      if (updatedDept) {
        setCurrentStaff(prev => prev ? { ...prev, departments: updatedDept as Department } : null);
      }

    } catch (err) {
      console.error('Error fetching queue items:', err);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  // Trigger fetch when staff selection updates
  useEffect(() => {
    fetchQueueData();
  }, [currentStaff]);

  // Realtime subscriber for staff view (keeps desk updated when check-ins arrive)
  useEffect(() => {
    if (!currentStaff) return;

    const channel = supabase
      .channel('staff-desk-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens', filter: `department_id=eq.${currentStaff.department_id}` },
        () => {
          fetchQueueData(true);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentStaff?.department_id]);

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const staffId = e.target.value;
    setSelectedStaffId(staffId);
    const staff = staffList.find(s => s.id === staffId) || null;
    setCurrentStaff(staff);
  };

  // POST action wrapper helper
  const performAction = async (endpoint: string, body: object) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('API Action failed');
      await fetchQueueData(true);
    } catch (err) {
      console.error(err);
      alert('Action failed. Ensure backend API is active.');
    } finally {
      setLoading(false);
    }
  };

  // Staff calls next waiting patient
  const handleCallNext = () => {
    if (!currentStaff) return;
    performAction('/staff/call-next', { staffId: currentStaff.id });
  };

  // Staff completes consultation and routes to next station
  const handleCompleteActive = () => {
    if (!activeToken) return;
    performAction('/staff/complete', { tokenId: activeToken.id });
  };

  // Staff triggers skip modal
  const handleOpenSkipModal = (tokenId: string) => {
    setSkipTokenId(tokenId);
    setSkipModalOpen(true);
  };

  // Staff confirms skip
  const handleConfirmSkip = async () => {
    setSkipModalOpen(false);
    await performAction('/staff/skip', { tokenId: skipTokenId, reason: skipReason });
    setSkipReason('Patient not present when called');
  };

  // Staff toggles patient priority
  const handleToggleUrgent = (tokenId: string) => {
    performAction('/staff/toggle-urgent', { tokenId });
  };

  // Staff toggles department bottleneck delay status
  const handleToggleBottleneck = async () => {
    if (!currentStaff) return;
    await performAction('/staff/toggle-bottleneck', { departmentId: currentStaff.department_id });
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
      
      {/* 1. Header & Desk Login Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 clinical-shadow flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">OPD Staff Operations Desk</h2>
            <p className="text-xs text-slate-500 font-medium">Manage queue streams, call patients, and signal bottlenecks.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Desk:</label>
          <select
            value={selectedStaffId}
            onChange={handleStaffChange}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-700"
          >
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.departments?.name || 'Admin Desk'})
              </option>
            ))}
          </select>
          <button 
            onClick={() => fetchQueueData()}
            disabled={refreshing}
            className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {currentStaff && currentStaff.departments ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Active Panel (Patient being served) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Active Patient Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 clinical-shadow">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Now Serving</h3>
              
              {activeToken ? (
                <div className="space-y-6">
                  <div className="text-center bg-teal-50/50 border border-teal-100/50 rounded-2xl py-6">
                    <span className="text-[10px] font-bold text-teal-800 uppercase bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-md">
                      Active
                    </span>
                    <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mt-3">
                      {activeToken.token_number}
                    </h1>
                    <p className="text-base font-bold text-slate-800 mt-1">{activeToken.patients.name}</p>
                    <p className="text-xs text-slate-500">{activeToken.patients.phone}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleCompleteActive}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 bg-clinical-emerald hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete & Route</span>
                    </button>
                    
                    <button
                      onClick={() => handleOpenSkipModal(activeToken.id)}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2.5 px-4 rounded-xl transition-colors text-xs"
                    >
                      <UserMinus className="w-4 h-4" />
                      <span>Patient Absent</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600">No Active Patient</p>
                  <p className="text-xs text-slate-400 max-w-[200px] mx-auto mt-1 mb-6 leading-relaxed">
                    Ready to admit the next OPD token in line.
                  </p>
                  
                  <button
                    onClick={handleCallNext}
                    disabled={loading || waitingTokens.length === 0}
                    className="inline-flex items-center gap-1.5 bg-clinical-teal hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-sm hover:shadow transition-colors text-xs disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Call Next Patient</span>
                  </button>
                </div>
              )}
            </div>

            {/* Department Bottleneck Control */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 clinical-shadow">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Station Bottleneck Signal</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    If this station experiences delays (e.g., equipment calibration, surge), toggle this flag. The AI guide will automatically inform patients.
                  </p>
                  
                  <button
                    onClick={handleToggleBottleneck}
                    disabled={loading}
                    className={`mt-4 px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
                      currentStaff.departments.is_bottleneck
                        ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Bottleneck Active:</span>
                    <span className="uppercase">{currentStaff.departments.is_bottleneck ? 'Yes' : 'No'}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* MIDDLE/RIGHT: Queue lists and audit history */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Waiting Queue List */}
            <div className="bg-white border border-slate-200 rounded-2xl clinical-shadow overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Department Queue Waiting Room</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Patients waiting to be called. Ordered by Priority and Registration time.</p>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full">
                  {waitingTokens.length} Waiting
                </span>
              </div>

              {waitingTokens.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                  {waitingTokens.map((token, index) => (
                    <div key={token.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-slate-300 font-bold text-sm w-5">{index + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-slate-900">{token.token_number}</span>
                            {token.is_urgent && (
                              <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-[9px] font-bold text-rose-700 rounded uppercase">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-600 mt-0.5">{token.patients.name}</p>
                          <p className="text-[10px] text-slate-400">Registered: {new Date(token.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Priority Toggle */}
                        <button
                          onClick={() => handleToggleUrgent(token.id)}
                          className={`p-2 rounded-lg border text-xs font-bold transition-colors ${
                            token.is_urgent
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                          title="Toggle Priority"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                        
                        {/* Direct Call Button */}
                        <button
                          onClick={() => performAction('/staff/call-next', { staffId: currentStaff.id })}
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-teal-600 hover:text-white transition-colors text-xs font-bold"
                          disabled={activeToken !== null}
                          title={activeToken ? 'Clear active token first' : 'Call patient'}
                        >
                          Call
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Queue Empty</p>
                  <p className="text-xs">No pending patients in the waiting area.</p>
                </div>
              )}
            </div>

            {/* Recent Desk History (Audit table) */}
            <div className="bg-white border border-slate-200 rounded-2xl clinical-shadow overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Processed Tickets (Recent Today)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Logs of completed or skipped tokens processed during this shift.</p>
              </div>

              {recentEvents.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                      <th className="p-4">Token</th>
                      <th className="p-4">Patient Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Actioned At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-800">{event.token_number}</td>
                        <td className="p-4 font-medium text-slate-600">{event.patients.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 font-bold rounded-md capitalize ${
                            event.status === 'completed' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">
                          {new Date(event.completed_at || event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No records actioned yet during this session.
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center clinical-shadow">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-semibold text-sm">Synchronizing staff configurations...</p>
        </div>
      )}

      {/* SKIP REASON MODAL DIALOG */}
      {skipModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-2">Mark Patient Absent</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a reason for skipping this token. This will be logged in the audit history and sent to the patient.
            </p>
            
            <div className="space-y-4 mb-6">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reason for skip</label>
              <input
                type="text"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setSkipModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSkip}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Skip Patient
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
