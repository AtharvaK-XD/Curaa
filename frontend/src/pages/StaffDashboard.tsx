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
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 text-zinc-100">
      
      {/* 1. Header & Desk Login Selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 clinical-shadow flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-950/40 border border-teal-800/50 text-teal-400 flex items-center justify-center shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">OPD Staff Operations Desk</h2>
            <p className="text-xs text-zinc-400 font-medium">Manage queue streams, call patients, and signal bottlenecks.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Select Desk:</label>
          <select
            value={selectedStaffId}
            onChange={handleStaffChange}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-zinc-950 font-medium text-zinc-300"
          >
            {staffList.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-950 text-zinc-350">
                {s.name} ({s.departments?.name || 'Admin Desk'})
              </option>
            ))}
          </select>
          <button 
            onClick={() => fetchQueueData()}
            disabled={refreshing}
            className="p-2 border border-zinc-850 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-400 transition-colors cursor-pointer"
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
            <div className="glass-panel border border-zinc-850 rounded-2xl p-6 clinical-shadow card-3d">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Now Serving</h3>
              
              {activeToken ? (
                <div className="space-y-6">
                  <div className="text-center bg-zinc-950 border border-zinc-900 shadow-inner rounded-2xl py-6 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] font-bold text-teal-400 uppercase bg-teal-950/40 border border-teal-900/60 px-1.5 py-0.5 rounded shadow-sm">
                        Active
                      </span>
                    </div>
                    <h1 className="text-5xl font-extrabold text-zinc-100 tracking-tight mt-3 depth-3d-text">
                      {activeToken.token_number}
                    </h1>
                    <p className="text-base font-bold text-zinc-200 mt-2">{activeToken.patients.name}</p>
                    <p className="text-xs text-zinc-500">{activeToken.patients.phone}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleCompleteActive}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 bg-clinical-emerald hover:bg-emerald-500 text-zinc-950 font-extrabold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-colors text-xs btn-3d cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                      <span>Complete & Route</span>
                    </button>
                    
                    <button
                      onClick={() => handleOpenSkipModal(activeToken.id)}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/50 font-extrabold py-2.5 px-4 rounded-xl transition-colors text-xs btn-3d cursor-pointer"
                    >
                      <UserMinus className="w-4 h-4 text-rose-400" />
                      <span>Absent / Skip</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-2xl">
                  <UserCheck className="w-10 h-10 text-zinc-650 mx-auto mb-3" />
                  <p className="text-sm font-bold text-zinc-400">No Active Patient</p>
                  <p className="text-xs text-zinc-650 max-w-[200px] mx-auto mt-1 mb-6 leading-relaxed">
                    Ready to admit the next OPD token in line.
                  </p>
                  
                  <button
                    onClick={handleCallNext}
                    disabled={loading || waitingTokens.length === 0}
                    className="inline-flex items-center gap-1.5 bg-clinical-teal hover:bg-teal-400 text-zinc-950 font-extrabold py-2.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-colors text-xs disabled:opacity-50 btn-3d cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
                    <span>Call Next Patient</span>
                  </button>
                </div>
              )}
            </div>

            {/* Department Bottleneck Control */}
            <div className="glass-panel border border-zinc-850 rounded-2xl p-6 clinical-shadow">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-200">Station Bottleneck Signal</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    If this station experiences delays (e.g., equipment calibration, surge), toggle this flag. The AI guide will automatically inform patients.
                  </p>
                  
                  <button
                    onClick={handleToggleBottleneck}
                    disabled={loading}
                    className={`mt-4 px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                      currentStaff.departments.is_bottleneck
                        ? 'bg-amber-950/40 border-amber-800/80 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : 'bg-zinc-950 border-zinc-855 text-zinc-500 hover:bg-zinc-900'
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
            <div className="glass-panel border border-zinc-850 rounded-2xl clinical-shadow overflow-hidden card-3d">
              <div className="p-6 border-b border-zinc-850 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-250">Department Queue Waiting Room</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Patients waiting to be called. Ordered by Priority and Registration time.</p>
                </div>
                <span className="px-2.5 py-1 bg-zinc-950 border border-zinc-900 text-zinc-400 text-xs font-bold rounded-full">
                  {waitingTokens.length} Waiting
                </span>
              </div>

              {waitingTokens.length > 0 ? (
                <div className="divide-y divide-zinc-900 max-h-[400px] overflow-y-auto">
                  {waitingTokens.map((token, index) => (
                    <div key={token.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-650 font-bold text-sm w-5">{index + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-zinc-200">{token.token_number}</span>
                            {token.is_urgent && (
                              <span className="px-1.5 py-0.5 bg-rose-950/30 border border-rose-900/60 text-[9px] font-bold text-rose-455 rounded uppercase shadow-sm">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-zinc-450 mt-0.5">{token.patients.name}</p>
                          <p className="text-[10px] text-zinc-600">Registered: {new Date(token.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Priority Toggle */}
                        <button
                          onClick={() => handleToggleUrgent(token.id)}
                          className={`p-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                            token.is_urgent
                              ? 'bg-rose-950/30 border-rose-900/60 text-rose-400 hover:bg-rose-950/60 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                              : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:bg-zinc-900'
                          }`}
                          title="Toggle Priority"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                        
                        {/* Direct Call Button */}
                        <button
                          onClick={() => performAction('/staff/call-next', { staffId: currentStaff.id })}
                          className="px-3 py-2 bg-zinc-950 text-zinc-400 rounded-lg hover:bg-teal-600 hover:text-white border border-zinc-855 hover:border-teal-500 transition-all text-xs font-bold btn-3d cursor-pointer"
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
                <div className="text-center py-12 text-zinc-500">
                  <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">Queue Empty</p>
                  <p className="text-xs text-zinc-650">No pending patients in the waiting area.</p>
                </div>
              )}
            </div>

            {/* Recent Desk History (Audit table) */}
            <div className="glass-panel border border-zinc-850 rounded-2xl clinical-shadow overflow-hidden">
              <div className="p-6 border-b border-zinc-850">
                <h3 className="text-sm font-bold text-zinc-250">Processed Tickets (Recent Today)</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Logs of completed or skipped tokens processed during this shift.</p>
              </div>

              {recentEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-950 text-zinc-500 font-bold border-b border-zinc-900">
                        <th className="p-4">Token</th>
                        <th className="p-4">Patient Name</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Actioned At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {recentEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-zinc-900/20">
                          <td className="p-4 font-bold text-zinc-200">{event.token_number}</td>
                          <td className="p-4 font-medium text-zinc-400">{event.patients.name}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 font-bold rounded-md capitalize border ${
                              event.status === 'completed' 
                                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40 shadow-[0_0_8px_rgba(52,211,153,0.08)]' 
                                : 'bg-rose-950/20 text-rose-400 border-rose-900/40'
                            }`}>
                              {event.status}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-500">
                            {new Date(event.completed_at || event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-zinc-600 text-xs">
                  No records actioned yet during this session.
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="glass-panel border border-zinc-850 rounded-2xl p-12 text-center clinical-shadow">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 font-semibold text-sm">Synchronizing staff configurations...</p>
        </div>
      )}

      {/* SKIP REASON MODAL DIALOG */}
      {skipModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/90 animate-in fade-in zoom-in-95 duration-150 text-zinc-200">
            <h3 className="text-base font-bold text-zinc-150 mb-2">Mark Patient Absent</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Enter a reason for skipping this token. This will be logged in the audit history and sent to the patient.
            </p>
            
            <div className="space-y-4 mb-6">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reason for skip</label>
              <input
                type="text"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-zinc-100 focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setSkipModalOpen(false)}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSkip}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md btn-3d cursor-pointer"
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
