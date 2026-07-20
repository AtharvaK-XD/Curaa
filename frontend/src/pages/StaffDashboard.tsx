import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { mockDatabase } from '../lib/mockDatabase';
import { 
  Users, UserCheck, AlertTriangle, Play, CheckCircle2, 
  UserMinus, ShieldAlert, RefreshCw, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        if (!isSupabaseConfigured) {
          const staffRecords = mockDatabase.getStaff() as unknown as StaffMember[];
          setStaffList(staffRecords);
          
          const defaultStaff = staffRecords.find(s => s.name.includes('Asha'));
          if (defaultStaff) {
            setSelectedStaffId(defaultStaff.id);
            setCurrentStaff(defaultStaff);
          } else if (staffRecords.length > 0) {
            setSelectedStaffId(staffRecords[0].id);
            setCurrentStaff(staffRecords[0]);
          }
          return;
        }

        const { data, error } = await supabase
          .from('staff')
          .select('*, departments(*)');
        if (error) throw error;
        
        const staffRecords = data as unknown as StaffMember[];
        setStaffList(staffRecords);
        
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

    if (!isSupabaseConfigured) {
      try {
        const deptId = currentStaff.department_id;
        const tokens = mockDatabase.getTokens();
        
        const waiting = tokens
          .filter((t: any) => t.department_id === deptId && t.status === 'waiting')
          .sort((a: any, b: any) => {
            if (a.is_urgent && !b.is_urgent) return -1;
            if (!a.is_urgent && b.is_urgent) return 1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
        setWaitingTokens(waiting as unknown as QueueToken[]);

        const active = tokens.find((t: any) => t.department_id === deptId && ['called', 'in_progress'].includes(t.status));
        setActiveToken(active ? (active as unknown as QueueToken) : null);

        const recent = tokens
          .filter((t: any) => t.department_id === deptId && ['completed', 'skipped'].includes(t.status))
          .sort((a: any, b: any) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime())
          .slice(0, 5);
        setRecentEvents(recent);

        const depts = mockDatabase.getDepartments();
        const curDept = depts.find(d => d.id === deptId);
        if (curDept) {
          setCurrentStaff(prev => prev ? { ...prev, departments: curDept } : null);
        }
      } catch (err) {
        console.error('Local queue fetch failed:', err);
      } finally {
        if (!silent) setRefreshing(false);
      }
      return;
    }

    try {
      const deptId = currentStaff.department_id;

      const { data: waiting, error: wError } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('department_id', deptId)
        .eq('status', 'waiting')
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: true });

      if (wError) throw wError;
      setWaitingTokens(waiting as unknown as QueueToken[]);

      const { data: active, error: aError } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('department_id', deptId)
        .in('status', ['called', 'in_progress'])
        .limit(1);

      if (aError) throw aError;
      setActiveToken(active && active.length > 0 ? (active[0] as unknown as QueueToken) : null);

      const { data: events } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('department_id', deptId)
        .in('status', ['completed', 'skipped'])
        .order('completed_at', { ascending: false })
        .limit(5);
      
      if (events) setRecentEvents(events);

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

  useEffect(() => {
    fetchQueueData();
  }, [currentStaff?.id, currentStaff?.department_id]);

  useEffect(() => {
    if (!currentStaff || !isSupabaseConfigured) return;

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

  const performAction = async (endpoint: string, body: any, mockAction: () => void) => {
    setLoading(true);
    
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        try {
          mockAction();
          fetchQueueData(true);
        } catch (err: any) {
          alert('Local action failed: ' + err.message);
        } finally {
          setLoading(false);
        }
      }, 500);
      return;
    }

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
      try {
        mockAction();
        fetchQueueData(true);
      } catch (e) {
        alert('Action failed. Ensure backend API is active.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCallNext = () => {
    if (!currentStaff) return;
    performAction(
      '/staff/call-next',
      { staffId: currentStaff.id },
      () => mockDatabase.callNext(currentStaff.id)
    );
  };

  const handleCompleteActive = () => {
    if (!activeToken) return;
    performAction(
      '/staff/complete',
      { tokenId: activeToken.id },
      () => mockDatabase.complete(activeToken.id)
    );
  };

  const handleOpenSkipModal = (tokenId: string) => {
    setSkipTokenId(tokenId);
    setSkipModalOpen(true);
  };

  const handleConfirmSkip = async () => {
    setSkipModalOpen(false);
    await performAction(
      '/staff/skip',
      { tokenId: skipTokenId, reason: skipReason },
      () => mockDatabase.skip(skipTokenId, skipReason)
    );
    setSkipReason('Patient not present when called');
  };

  const handleToggleUrgent = (tokenId: string) => {
    performAction(
      '/staff/toggle-urgent',
      { tokenId },
      () => mockDatabase.toggleUrgent(tokenId)
    );
  };

  const handleToggleBottleneck = async () => {
    if (!currentStaff) return;
    await performAction(
      '/staff/toggle-bottleneck',
      { departmentId: currentStaff.department_id },
      () => mockDatabase.toggleBottleneck(currentStaff.department_id)
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 max-w-[1800px] mx-auto w-full px-6 lg:px-10 py-8 text-zinc-100"
    >
      
      {/* Header and Desk Select panel */}
      <div className="bg-[#0a0a10]/80 border border-white/[0.05] rounded-3xl p-6 mb-8 clinical-shadow flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shadow-inner">
            <Users className="w-6 h-6 text-clinical-teal animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-150 font-display">OPD Staff Operations Desk</h2>
            <p className="text-xs text-zinc-550 font-medium">Manage department streams, call waiting patients, and route tickets.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 bg-[#050508] border border-white/[0.08] p-1.5 rounded-2xl">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-3 pr-1">Active Station:</span>
            <select
              value={selectedStaffId}
              onChange={handleStaffChange}
              className="px-4 py-1.5 text-xs rounded-xl border border-white/[0.05] bg-[#0c0c14] font-semibold text-zinc-300 focus:outline-none appearance-none cursor-pointer"
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#050508] text-zinc-300">
                  {s.name} ({s.departments?.name || 'Admin Desk'})
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => fetchQueueData()}
            disabled={refreshing}
            className="p-2.5 border border-white/[0.08] rounded-xl bg-[#08080c] hover:bg-white/[0.04] text-zinc-400 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-clinical-teal ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {currentStaff && currentStaff.departments ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Active Patient Panel (1/3 Width) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Now Serving Card - Animated with spring transitions */}
            <div className="glass-panel border border-white/[0.05] rounded-3xl p-6 clinical-shadow card-3d">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Now Serving</h3>
              
              <AnimatePresence mode="wait">
                {activeToken ? (
                  <motion.div
                    key={activeToken.id}
                    initial={{ opacity: 0, scale: 0.94, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -15 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="space-y-6"
                  >
                    <div className="text-center bg-[#040406] border border-white/[0.02] shadow-inner rounded-3xl py-6 relative overflow-hidden">
                      <div className="absolute top-3 right-3">
                        <span className="text-[8px] font-bold text-clinical-teal uppercase bg-clinical-teal/10 border border-clinical-teal/20 px-2 py-0.5 rounded shadow-sm animate-pulse">
                          Active
                        </span>
                      </div>
                      
                      <h1 className="text-5xl font-extrabold text-zinc-100 tracking-tight mt-4 depth-3d-text font-display">
                        {activeToken.token_number}
                      </h1>
                      <p className="text-sm font-bold text-zinc-200 mt-3 font-display">{activeToken.patients.name}</p>
                      <p className="text-xs text-zinc-550 mt-1">{activeToken.patients.phone}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleCompleteActive}
                        disabled={loading}
                        className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-clinical-emerald to-emerald-400 text-zinc-950 font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs btn-3d cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                        <span>Complete & Route</span>
                      </button>
                      
                      <button
                        onClick={() => handleOpenSkipModal(activeToken.id)}
                        disabled={loading}
                        className="flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold py-3 px-4 rounded-xl transition-all text-xs btn-3d cursor-pointer"
                      >
                        <UserMinus className="w-4 h-4 text-rose-400" />
                        <span>Absent / Skip</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="no-active"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-12 border border-dashed border-white/[0.08] rounded-2xl"
                  >
                    <UserCheck className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No Active Patient</p>
                    <p className="text-[11px] text-zinc-650 max-w-[200px] mx-auto mt-2 mb-6 leading-relaxed">
                      Ready to admit the next outpatient ticket waiting in line.
                    </p>
                    
                    <button
                      onClick={handleCallNext}
                      disabled={loading || waitingTokens.length === 0}
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-clinical-teal to-teal-400 text-zinc-950 font-bold py-2.5 px-6 rounded-xl shadow-md transition-colors text-xs disabled:opacity-40 btn-3d cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
                      <span>Call Next Patient</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Department Bottleneck Control Switch */}
            <div className="glass-panel border border-white/[0.05] rounded-3xl p-6 clinical-shadow">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-450 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Counter Delay Warning</h3>
                  <p className="text-[11px] text-zinc-550 mt-2 leading-relaxed">
                    If this specific department faces processing surge, toggle the bottleneck delay signal. The logistics chatbot will automatically routing adjust wait times.
                  </p>
                  
                  <button
                    onClick={handleToggleBottleneck}
                    disabled={loading}
                    className={`mt-4 px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                      currentStaff.departments.is_bottleneck
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : 'bg-[#08080c] border-white/[0.08] text-zinc-500 hover:text-zinc-355'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${currentStaff.departments.is_bottleneck ? 'bg-amber-500 animate-ping' : 'bg-zinc-650'}`}></span>
                    <span>Surge Alert: {currentStaff.departments.is_bottleneck ? 'ACTIVE' : 'STANDBY'}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Queue Lists & History Logs (2/3 Width) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Waiting Queue List Card */}
            <div className="glass-panel border border-white/[0.05] rounded-3xl clinical-shadow overflow-hidden card-3d">
              <div className="p-6 border-b border-white/[0.04] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-250 font-display">Waiting Lounge Queue</h3>
                  <p className="text-xs text-zinc-550 mt-1">Patients checked in and waiting. Ordered by Urgency priority then Registration time.</p>
                </div>
                <span className="px-3.5 py-1 bg-[#050508] border border-white/[0.06] text-clinical-teal text-[11px] font-bold rounded-full">
                  {waitingTokens.length} Pending
                </span>
              </div>

              {waitingTokens.length > 0 ? (
                <motion.div 
                  layout
                  className="divide-y divide-white/[0.04] max-h-[350px] overflow-y-auto"
                >
                  <AnimatePresence>
                    {waitingTokens.map((token, index) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ type: 'spring', damping: 20 }}
                        whileHover={{ scale: 1.005, backgroundColor: 'rgba(255,255,255,0.01)' }}
                        key={token.id} 
                        className="p-4 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-600 font-bold text-xs w-5 text-right">{index + 1}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-extrabold text-zinc-250 font-display">{token.token_number}</span>
                              {token.is_urgent && (
                                <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-455 rounded uppercase tracking-wider animate-pulse">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-zinc-400 mt-0.5">{token.patients.name}</p>
                            <p className="text-[10px] text-zinc-600">Registered: {new Date(token.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleUrgent(token.id)}
                            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                              token.is_urgent
                                ? 'bg-rose-500/10 border-rose-500/25 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                                : 'bg-[#08080c] border-white/[0.06] text-zinc-550 hover:text-zinc-350'
                            }`}
                            title="Toggle Urgency State"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => {
                              if (!isSupabaseConfigured) {
                                performAction('', {}, () => {
                                  const tk = mockDatabase.getToken(token.id)!;
                                  tk.status = 'called';
                                  tk.called_at = new Date().toISOString();
                                  const allT = getStorageItem<any[]>('tokens', []);
                                  const idx = allT.findIndex((t: any) => t.id === token.id);
                                  if (idx >= 0) allT[idx] = tk;
                                  setStorageItem('tokens', allT);
                                });
                                return;
                              }
                              performAction('/staff/call-next', { staffId: currentStaff.id }, () => {});
                            }}
                            className="px-3 py-2 bg-[#08080c] text-zinc-400 rounded-xl hover:bg-clinical-teal hover:text-zinc-950 border border-white/[0.06] hover:border-clinical-teal transition-all text-xs font-bold btn-3d cursor-pointer"
                            disabled={activeToken !== null}
                            title={activeToken ? 'Complete active consultation first' : 'Call patient counter'}
                          >
                            Call Direct
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="text-center py-12 text-zinc-550">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-20 text-clinical-teal animate-pulse" />
                  <p className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Queue Cleared</p>
                  <p className="text-[11px] text-zinc-650 mt-1">No pending outpatient tickets in waiting room.</p>
                </div>
              )}
            </div>

            {/* Audit Log Desk History */}
            <div className="glass-panel border border-white/[0.05] rounded-3xl clinical-shadow overflow-hidden">
              <div className="p-6 border-b border-white/[0.04]">
                <h3 className="text-sm font-bold text-zinc-250 font-display">Shift Session Action Logs</h3>
                <p className="text-xs text-zinc-550 mt-1">History of outpatient tickets completed or skipped by your counter today.</p>
              </div>

              {recentEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#050508] text-zinc-500 font-bold border-b border-white/[0.04]">
                        <th className="p-4 font-display uppercase tracking-widest text-[9px]">Token</th>
                        <th className="p-4 font-display uppercase tracking-widest text-[9px]">Patient Name</th>
                        <th className="p-4 font-display uppercase tracking-widest text-[9px]">Event Status</th>
                        <th className="p-4 font-display uppercase tracking-widest text-[9px]">Logged Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {recentEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 font-bold text-zinc-200 font-display">{event.token_number}</td>
                          <td className="p-4 font-semibold text-zinc-400">{event.patients?.name || 'Demo Patient'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 font-bold rounded-lg capitalize border text-[10px] tracking-wide ${
                              event.status === 'completed' 
                                ? 'bg-emerald-500/10 text-emerald-455 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-455 border-rose-500/20'
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
                <div className="p-8 text-center text-zinc-650 text-xs">
                  No actions logged during this session shift.
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="glass-panel border border-white/[0.05] rounded-3xl p-12 text-center clinical-shadow">
          <RefreshCw className="w-8 h-8 text-clinical-teal animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 font-semibold text-xs uppercase tracking-widest">Configuring Operations Feed...</p>
        </div>
      )}

      {/* SKIP PATIENT ABSENT MODAL DIALOG */}
      <AnimatePresence>
        {skipModalOpen && (
          <div className="fixed inset-0 bg-[#050508]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0c0d16] border border-white/[0.06] rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-black text-zinc-200"
            >
              <h3 className="text-base font-bold text-zinc-150 mb-1 font-display">Mark Patient Absent</h3>
              <p className="text-xs text-zinc-550 mb-5 leading-relaxed">
                Log skipped status. The system audit trail will store the reason and dispatch SMS alerts to the patient.
              </p>
              
              <div className="space-y-4 mb-6">
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Reason for skip</label>
                <input
                  type="text"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/[0.06] bg-[#050508] rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-clinical-blue"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/[0.04] pt-4">
                <button
                  onClick={() => setSkipModalOpen(false)}
                  className="px-4 py-2 bg-[#050508] hover:bg-[#12121e] border border-white/[0.06] text-zinc-400 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSkip}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md btn-3d cursor-pointer"
                >
                  Skip Patient
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

const DB_PREFIX = 'curaa_mock_';
const getStorageItem = <T,>(key: string, defaultValue: T): T => {
  const item = localStorage.getItem(DB_PREFIX + key);
  return item ? JSON.parse(item) : defaultValue;
};
const setStorageItem = (key: string, data: any) => {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
};
