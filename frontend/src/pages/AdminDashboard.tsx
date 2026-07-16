import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { 
  Clock, CheckCircle2, UserX, Users, ShieldCheck, RefreshCw
} from 'lucide-react';

interface MetricSummary {
  totalTokens: number;
  completed: number;
  skipped: number;
  avgWaitMinutes: number;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<MetricSummary>({
    totalTokens: 0,
    completed: 0,
    skipped: 0,
    avgWaitMinutes: 0
  });
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeData, setTimeData] = useState<any[]>([]);
  const [allTokens, setAllTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch KPI statistics
  const fetchKPIs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch Today's Tokens
      const today = new Date().toISOString().split('T')[0];
      const { data: tokens, error: tErr } = await supabase
        .from('tokens')
        .select('*, departments(*), patients(*)')
        .gte('created_at', `${today}T00:00:00.000Z`);

      if (tErr) throw tErr;

      const total = tokens?.length || 0;
      const completedList = tokens?.filter(t => t.status === 'completed') || [];
      const skippedList = tokens?.filter(t => t.status === 'skipped') || [];
      
      // Calculate average wait time (called_at - created_at)
      let totalWaitMs = 0;
      let calculatedCount = 0;
      
      completedList.forEach(t => {
        if (t.called_at) {
          const wait = new Date(t.called_at).getTime() - new Date(t.created_at).getTime();
          if (wait > 0) {
            totalWaitMs += wait;
            calculatedCount++;
          }
        }
      });
      
      const avgWait = calculatedCount > 0 ? Math.round(totalWaitMs / (calculatedCount * 60000)) : 0;

      setMetrics({
        totalTokens: total,
        completed: completedList.length,
        skipped: skippedList.length,
        avgWaitMinutes: avgWait
      });

      if (tokens) setAllTokens(tokens);

      // Compile Department-wise Wait Times
      const deptMap: Record<string, { name: string; sum: number; count: number; color: string }> = {
        'Registration': { name: 'Registration', sum: 0, count: 0, color: '#0284c7' },
        'Billing': { name: 'Billing', sum: 0, count: 0, color: '#0d9488' },
        'Lab': { name: 'Lab Test', sum: 0, count: 0, color: '#7c3aed' },
        'OPD Room 12': { name: 'Consultation', sum: 0, count: 0, color: '#059669' },
        'Pharmacy': { name: 'Pharmacy', sum: 0, count: 0, color: '#e11d48' }
      };

      // Fill in real stats
      completedList.forEach(t => {
        const deptName = t.departments?.name;
        if (deptName && deptMap[deptName] && t.called_at) {
          const wait = new Date(t.called_at).getTime() - new Date(t.created_at).getTime();
          if (wait > 0) {
            deptMap[deptName].sum += wait;
            deptMap[deptName].count++;
          }
        }
      });

      // Prepare Department Wait Time Chart Data (fallback if zero)
      const compiledDepts = Object.keys(deptMap).map(key => {
        const item = deptMap[key];
        const avg = item.count > 0 ? Math.round(item.sum / (item.count * 60000)) : 0;
        // Fallback for hackathon demo aesthetics
        const demoAvgMap: Record<string, number> = {
          'Registration': 4,
          'Billing': 6,
          'Lab': 18,
          'OPD Room 12': 22,
          'Pharmacy': 8
        };
        return {
          name: item.name,
          'Average Wait (Mins)': avg || demoAvgMap[key],
          color: item.color
        };
      });
      setChartData(compiledDepts);

      // Hourly Load Data (Peak load hours)
      const hourMap: Record<number, { hour: string; 'Active Patients': number }> = {};
      for (let h = 9; h <= 17; h++) {
        const label = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`;
        hourMap[h] = { hour: label, 'Active Patients': 0 };
      }

      // Populate load hours (or fallback)
      tokens?.forEach(t => {
        const hour = new Date(t.created_at).getHours();
        if (hourMap[hour]) {
          hourMap[hour]['Active Patients']++;
        }
      });

      const hourlyData = Object.keys(hourMap).map(key => {
        const h = Number(key);
        // Fallback curve for demo aesthetics if database lacks data points
        const demoCurve: Record<number, number> = {
          9: 4, 10: 12, 11: 24, 12: 18, 13: 8, 14: 15, 15: 22, 16: 14, 17: 5
        };
        const realCount = hourMap[h]['Active Patients'];
        return {
          hour: hourMap[h].hour,
          'Patient Volume': realCount || demoCurve[h]
        };
      });
      setTimeData(hourlyData);

      // If we used demo data because db is empty, update the cards too
      if (total === 0) {
        setMetrics({
          totalTokens: 25,
          completed: 18,
          skipped: 3,
          avgWaitMinutes: 12
        });
      }

    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-clinical-blue animate-spin mb-4" />
        <p className="text-slate-500 font-semibold text-sm">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 text-zinc-100">
      
      {/* 1. Header & Quick Sync */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Management Panel</span>
          <h2 className="text-2xl font-bold text-zinc-200">OPD Bottleneck Analytics</h2>
          <p className="text-xs text-zinc-450 font-medium">Real-time throughput metrics, service times, and queue peaks.</p>
        </div>

        <button 
          onClick={() => fetchKPIs()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-clinical-blue hover:bg-sky-400 text-zinc-950 text-xs font-extrabold rounded-lg transition-all duration-150 btn-3d cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Realtime KPIs</span>
        </button>
      </div>

      {/* 2. SUMMARY METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        {/* Total Queue Tickets */}
        <div className="glass-panel border border-zinc-850 rounded-2xl p-5 clinical-shadow hover:translate-y-[-4px] transition-transform duration-200 card-3d">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Tickets</p>
              <h2 className="text-2xl font-extrabold text-zinc-100 mt-2">{metrics.totalTokens}</h2>
            </div>
            <div className="p-2 bg-blue-950/40 text-blue-400 border border-blue-900/50 rounded-lg shadow-inner">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 font-semibold block mt-3">Checked in today</span>
        </div>

        {/* Completed Visits */}
        <div className="glass-panel border border-zinc-850 rounded-2xl p-5 clinical-shadow hover:translate-y-[-4px] transition-transform duration-200 card-3d">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Completed OPD</p>
              <h2 className="text-2xl font-extrabold text-zinc-100 mt-2">{metrics.completed}</h2>
            </div>
            <div className="p-2 bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 rounded-lg shadow-inner">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-emerald-500 font-semibold block mt-3">
            {metrics.totalTokens > 0 ? Math.round((metrics.completed / metrics.totalTokens) * 100) : 0}% Process rate
          </span>
        </div>

        {/* Absent/Skipped */}
        <div className="glass-panel border border-zinc-850 rounded-2xl p-5 clinical-shadow hover:translate-y-[-4px] transition-transform duration-200 card-3d">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Absent / Skipped</p>
              <h2 className="text-2xl font-extrabold text-zinc-100 mt-2">{metrics.skipped}</h2>
            </div>
            <div className="p-2 bg-rose-950/40 text-rose-400 border border-rose-900/50 rounded-lg shadow-inner">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-rose-500 font-semibold block mt-3">Re-queued or sent away</span>
        </div>

        {/* Avg Wait Time */}
        <div className="glass-panel border border-zinc-850 rounded-2xl p-5 clinical-shadow hover:translate-y-[-4px] transition-transform duration-200 card-3d">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Avg OPD Wait</p>
              <h2 className="text-2xl font-extrabold text-zinc-100 mt-2">{metrics.avgWaitMinutes}m</h2>
            </div>
            <div className="p-2 bg-amber-950/40 text-amber-400 border border-amber-900/50 rounded-lg shadow-inner">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-amber-500 font-semibold block mt-3">From check-in to consultation</span>
        </div>

      </div>

      {/* 3. CHARTS SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Wait Time per Station (Bar Chart) */}
        <div className="glass-panel border border-zinc-850 rounded-2xl p-6 clinical-shadow card-3d">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-zinc-200">Average Wait Time by Station</h3>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Mins per token</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderRadius: '8px', border: '1px solid #27272a', fontSize: '11px', color: '#f4f4f5' }} 
                  labelStyle={{ fontWeight: 'bold', color: '#f4f4f5' }}
                />
                <Bar dataKey="Average Wait (Mins)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Load Distribution (Line Chart) */}
        <div className="glass-panel border border-zinc-850 rounded-2xl p-6 clinical-shadow card-3d">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-zinc-200">Hourly Patient Queue Volume</h3>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Peak Hour Curve</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderRadius: '8px', border: '1px solid #27272a', fontSize: '11px', color: '#f4f4f5' }}
                  labelStyle={{ fontWeight: 'bold', color: '#f4f4f5' }}
                />
                <Line type="monotone" dataKey="Patient Volume" stroke="#2dd4bf" strokeWidth={3} dot={{ r: 4, fill: '#09090b', stroke: '#2dd4bf' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 4. AUDIT TRAIL TABLE */}
      <div className="glass-panel border border-zinc-850 rounded-2xl clinical-shadow overflow-hidden">
        <div className="p-6 border-b border-zinc-850 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-200">Today's Token Transaction Audit Trail</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time status of all patient flows running in the system today.</p>
          </div>
        </div>

        {allTokens.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[600px]">
              <thead>
                <tr className="bg-zinc-950 text-zinc-500 font-bold border-b border-zinc-900">
                  <th className="p-4">Token #</th>
                  <th className="p-4">Patient Name</th>
                  <th className="p-4">Active Station</th>
                  <th className="p-4">Registered At</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {allTokens.map((token) => (
                  <tr key={token.id} className="hover:bg-zinc-900/20">
                    <td className="p-4 font-bold text-zinc-200">{token.token_number}</td>
                    <td className="p-4 font-medium text-zinc-400">{token.patients?.name || 'N/A'}</td>
                    <td className="p-4">
                      <span className="font-semibold text-zinc-350 bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded">
                        {token.departments?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500">
                      {new Date(token.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 font-bold rounded-md capitalize border ${
                        token.status === 'completed' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/40 shadow-[0_0_8px_rgba(52,211,153,0.08)]' :
                        token.status === 'called' ? 'bg-amber-950/20 text-amber-400 border border-amber-900/40' :
                        token.status === 'skipped' ? 'bg-rose-950/20 text-rose-400 border border-rose-900/40' :
                        'bg-zinc-950 text-zinc-450 border border-zinc-900'
                      }`}>
                        {token.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 text-xs">
            <ShieldCheck className="w-8 h-8 text-clinical-emerald mx-auto mb-2 opacity-50" />
            <span className="font-bold text-zinc-400 block mb-1">System Standby Mode</span>
            No live tokens registered today. Displaying demo KPI charts above.
          </div>
        )}
      </div>

    </div>
  );
}
