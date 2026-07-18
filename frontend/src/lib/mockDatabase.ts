// Client-side Mock Database simulation for Curaa OPD Queue
// Simulates PostgreSQL schema locally using localStorage

export interface Department {
  id: string;
  name: string;
  floor: number;
  room_number: string;
  color_code: string;
  avg_service_time_minutes: number;
  is_bottleneck: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  preferred_language: 'en' | 'hi' | 'gu';
  created_at: string;
}

export interface Token {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  department_id: string;
  token_number: string;
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'skipped';
  is_urgent: boolean;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  departments?: Department;
  patients?: Patient;
}

export interface Staff {
  id: string;
  name: string;
  department_id: string | null;
  role: 'staff' | 'admin';
  departments?: Department;
}

export interface QueueEvent {
  id: string;
  token_id: string;
  event_type: 'created' | 'called' | 'skipped' | 'completed' | 'rerouted';
  department_id: string;
  actor: 'system' | 'staff' | 'patient';
  metadata: Record<string, any>;
  created_at: string;
}

export interface AlertLog {
  id: string;
  token_id: string;
  channel: 'sms' | 'whatsapp' | 'in_app';
  message: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
}

const DEPARTMENTS: Department[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Registration',
    floor: 1,
    room_number: 'Counter 1',
    color_code: 'blue',
    avg_service_time_minutes: 5,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Billing',
    floor: 1,
    room_number: 'Counter 2',
    color_code: 'teal',
    avg_service_time_minutes: 8,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    name: 'Lab',
    floor: 2,
    room_number: 'Room 201',
    color_code: 'purple',
    avg_service_time_minutes: 15,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    name: 'OPD Room 12',
    floor: 3,
    room_number: 'Room 305',
    color_code: 'emerald',
    avg_service_time_minutes: 20,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    name: 'Pharmacy',
    floor: 1,
    room_number: 'Counter 3',
    color_code: 'rose',
    avg_service_time_minutes: 10,
    is_bottleneck: false
  }
];

const STAFF: Staff[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Dr. Ramesh Kumar (OPD Room 12)',
    department_id: 'b0000000-0000-0000-0000-000000000004',
    role: 'staff'
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Asha Sharma (Registration)',
    department_id: 'b0000000-0000-0000-0000-000000000001',
    role: 'staff'
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    name: 'Vikram Patel (Billing)',
    department_id: 'b0000000-0000-0000-0000-000000000002',
    role: 'staff'
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    name: 'Dr. Sneha Patel (Lab)',
    department_id: 'b0000000-0000-0000-0000-000000000003',
    role: 'staff'
  },
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    name: 'Rajesh Gupta (Pharmacy)',
    department_id: 'b0000000-0000-0000-0000-000000000005',
    role: 'staff'
  },
  {
    id: 'c0000000-0000-0000-0000-000000000009',
    name: 'System Admin',
    department_id: null,
    role: 'admin'
  }
];

// Helper to generate UUID
const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Storage key helpers
const DB_PREFIX = 'curaa_mock_';
const getStorageItem = <T,>(key: string, defaultValue: T): T => {
  const item = localStorage.getItem(DB_PREFIX + key);
  return item ? JSON.parse(item) : defaultValue;
};
const setStorageItem = (key: string, data: any) => {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
};

// Initialize Mock Database
export const initMockDb = () => {
  if (!localStorage.getItem(DB_PREFIX + 'initialized')) {
    setStorageItem('departments', DEPARTMENTS);
    setStorageItem('staff', STAFF);
    setStorageItem('patients', [
      {
        id: 'p100',
        name: 'Rahul Sharma',
        phone: '+919876543210',
        preferred_language: 'en',
        created_at: new Date().toISOString()
      },
      {
        id: 'p101',
        name: 'Amit Patel',
        phone: '+919876543222',
        preferred_language: 'hi',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'p102',
        name: 'Gita Mehta',
        phone: '+919876543233',
        preferred_language: 'gu',
        created_at: new Date(Date.now() - 7200000).toISOString()
      }
    ]);

    // Initial mock queue state
    const today = new Date().toISOString().split('T')[0];
    setStorageItem('tokens', [
      {
        id: 't100',
        patient_id: 'p101',
        appointment_id: null,
        department_id: 'b0000000-0000-0000-0000-000000000001',
        token_number: 'REG-101',
        status: 'completed',
        is_urgent: false,
        created_at: `${today}T09:15:00.000Z`,
        called_at: `${today}T09:20:00.000Z`,
        completed_at: `${today}T09:25:00.000Z`
      },
      {
        id: 't101',
        patient_id: 'p101',
        appointment_id: null,
        department_id: 'b0000000-0000-0000-0000-000000000002',
        token_number: 'BIL-101',
        status: 'completed',
        is_urgent: false,
        created_at: `${today}T09:26:00.000Z`,
        called_at: `${today}T09:30:00.000Z`,
        completed_at: `${today}T09:38:00.000Z`
      },
      {
        id: 't102',
        patient_id: 'p102',
        appointment_id: null,
        department_id: 'b0000000-0000-0000-0000-000000000001',
        token_number: 'REG-102',
        status: 'completed',
        is_urgent: false,
        created_at: `${today}T10:05:00.000Z`,
        called_at: `${today}T10:10:00.000Z`,
        completed_at: `${today}T10:14:00.000Z`
      },
      {
        id: 't103',
        patient_id: 'p102',
        appointment_id: null,
        department_id: 'b0000000-0000-0000-0000-000000000002',
        token_number: 'BIL-102',
        status: 'called',
        is_urgent: false,
        created_at: `${today}T10:15:00.000Z`,
        called_at: `${today}T10:22:00.000Z`,
        completed_at: null
      },
      {
        id: 't104',
        patient_id: 'p101',
        appointment_id: null,
        department_id: 'b0000000-0000-0000-0000-000000000003',
        token_number: 'LAB-101',
        status: 'waiting',
        is_urgent: true,
        created_at: `${today}T09:40:00.000Z`,
        called_at: null,
        completed_at: null
      }
    ]);

    setStorageItem('queue_events', []);
    setStorageItem('alerts_log', []);
    localStorage.setItem(DB_PREFIX + 'initialized', 'true');
  }
};

// API Helpers
export const mockDatabase = {
  getDepartments: (): Department[] => {
    initMockDb();
    return getStorageItem<Department[]>('departments', DEPARTMENTS);
  },

  getStaff: (): Staff[] => {
    initMockDb();
    const staff = getStorageItem<Staff[]>('staff', STAFF);
    const depts = mockDatabase.getDepartments();
    return staff.map(s => ({
      ...s,
      departments: depts.find(d => d.id === s.department_id)
    }));
  },

  getTokens: (): Token[] => {
    initMockDb();
    const tokens = getStorageItem<Token[]>('tokens', []);
    const depts = mockDatabase.getDepartments();
    const patients = getStorageItem<Patient[]>('patients', []);
    return tokens.map((t) => ({
      ...t,
      departments: depts.find(d => d.id === t.department_id),
      patients: patients.find((p) => p.id === t.patient_id)
    }));
  },

  getToken: (id: string): Token | null => {
    const tokens = mockDatabase.getTokens();
    return tokens.find(t => t.id === id) || null;
  },

  getPatientTokens: (patientId: string): Token[] => {
    const tokens = mockDatabase.getTokens();
    return tokens.filter(t => t.patient_id === patientId);
  },

  getDepartmentQueue: (departmentId: string): Token[] => {
    const tokens = mockDatabase.getTokens();
    return tokens.filter(t => t.department_id === departmentId);
  },

  getAlertsForToken: (tokenId: string): AlertLog[] => {
    const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
    return alerts.filter((a) => a.token_id === tokenId);
  },

  clearAlertsForToken: (tokenId: string) => {
    const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
    const updated = alerts.map((a) => a.token_id === tokenId ? { ...a, status: 'sent' as const } : a);
    setStorageItem('alerts_log', updated);
  },

  checkIn: (name: string, phone: string, preferred_language: 'en' | 'hi' | 'gu', doctorName?: string): Token => {
    initMockDb();
    const patients = getStorageItem<Patient[]>('patients', []);
    let patient = patients.find((p) => p.phone === phone);
    if (!patient) {
      patient = {
        id: uuid(),
        name,
        phone,
        preferred_language,
        created_at: new Date().toISOString()
      };
      patients.push(patient);
      setStorageItem('patients', patients);
    } else {
      patient.name = name; // Update name in case it changed
      patient.preferred_language = preferred_language;
      setStorageItem('patients', patients);
    }

    const depts = mockDatabase.getDepartments();
    const regDept = depts.find(d => d.name.toLowerCase().includes('reg')) || depts[0];

    const tokens = getStorageItem<Token[]>('tokens', []);
    const deptTokens = tokens.filter((t) => t.department_id === regDept.id);
    const tokenIndex = deptTokens.length + 101;
    const tokenNumber = `REG-${tokenIndex}`;

    const newToken: Token = {
      id: uuid(),
      patient_id: patient.id,
      appointment_id: doctorName ? uuid() : null,
      department_id: regDept.id,
      token_number: tokenNumber,
      status: 'waiting',
      is_urgent: false,
      created_at: new Date().toISOString(),
      called_at: null,
      completed_at: null
    };

    tokens.push(newToken);
    setStorageItem('tokens', tokens);

    // Queue events log
    const events = getStorageItem<QueueEvent[]>('queue_events', []);
    events.push({
      id: uuid(),
      token_id: newToken.id,
      event_type: 'created',
      department_id: regDept.id,
      actor: 'patient',
      metadata: { doctorName, source: 'offline_check_in' },
      created_at: new Date().toISOString()
    });
    setStorageItem('queue_events', events);

    // Queue alerts
    const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
    alerts.push({
      id: uuid(),
      token_id: newToken.id,
      channel: 'in_app',
      message: `Welcome ${name}! Your token for Registration is ${tokenNumber}. Please wait in the main lobby.`,
      sent_at: new Date().toISOString(),
      status: 'pending'
    });
    alerts.push({
      id: uuid(),
      token_id: newToken.id,
      channel: 'sms',
      message: `Welcome ${name}! Token ${tokenNumber} generated. Registration is at Floor ${regDept.floor}, ${regDept.room_number}.`,
      sent_at: new Date().toISOString(),
      status: 'pending'
    });
    setStorageItem('alerts_log', alerts);

    return {
      ...newToken,
      departments: regDept,
      patients: patient
    };
  },

  callNext: (staffId: string): Token | null => {
    const staff = mockDatabase.getStaff();
    const currentStaff = staff.find(s => s.id === staffId);
    if (!currentStaff || !currentStaff.department_id) return null;

    const deptId = currentStaff.department_id;
    const tokens = getStorageItem<Token[]>('tokens', []);

    // 1. If there's an active called/in_progress token, let's complete it or skip it?
    // Let's assume the staff must explicitly complete/skip, but to prevent weird states,
    // we let them call next if there's no active.
    const active = tokens.find((t) => t.department_id === deptId && (t.status === 'called' || t.status === 'in_progress'));
    if (active) return mockDatabase.getToken(active.id);

    // 2. Find next waiting token
    const waitingList = tokens
      .filter((t) => t.department_id === deptId && t.status === 'waiting')
      .sort((a, b) => {
        if (a.is_urgent && !b.is_urgent) return -1;
        if (!a.is_urgent && b.is_urgent) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    if (waitingList.length === 0) return null;

    const nextToken = tokens.find((t) => t.id === waitingList[0].id);
    if (nextToken) {
      nextToken.status = 'called';
      nextToken.called_at = new Date().toISOString();
      setStorageItem('tokens', tokens);

      // Log event
      const events = getStorageItem<QueueEvent[]>('queue_events', []);
      events.push({
        id: uuid(),
        token_id: nextToken.id,
        event_type: 'called',
        department_id: deptId,
        actor: 'staff',
        metadata: { called_by: currentStaff.name },
        created_at: new Date().toISOString()
      });
      setStorageItem('queue_events', events);

      // Queue alert for this patient
      const depts = mockDatabase.getDepartments();
      const currentDept = depts.find(d => d.id === deptId)!;
      const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
      const alertMsg = `Token ${nextToken.token_number} is called! Proceed to ${currentDept.name}, Floor ${currentDept.floor}, ${currentDept.room_number}.`;
      alerts.push({
        id: uuid(),
        token_id: nextToken.id,
        channel: 'in_app',
        message: alertMsg,
        sent_at: new Date().toISOString(),
        status: 'pending'
      });
      alerts.push({
        id: uuid(),
        token_id: nextToken.id,
        channel: 'sms',
        message: alertMsg,
        sent_at: new Date().toISOString(),
        status: 'pending'
      });
      setStorageItem('alerts_log', alerts);

      // Alert upcoming 3 patients
      const upcoming = tokens
        .filter((t) => t.department_id === deptId && t.status === 'waiting' && t.id !== nextToken.id)
        .sort((a, b) => {
          if (a.is_urgent && !b.is_urgent) return -1;
          if (!a.is_urgent && b.is_urgent) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .slice(0, 3);

      upcoming.forEach((upToken, idx) => {
        const ahead = idx + 1;
        const msg = `Hi, you are ${ahead} patient${ahead > 1 ? 's' : ''} away in the ${currentDept.name} queue. Please head to Floor ${currentDept.floor}, ${currentDept.room_number}.`;
        alerts.push({
          id: uuid(),
          token_id: upToken.id,
          channel: 'sms',
          message: msg,
          sent_at: new Date().toISOString(),
          status: 'pending'
        });
      });
      setStorageItem('alerts_log', alerts);

      return mockDatabase.getToken(nextToken.id);
    }
    return null;
  },

  complete: (tokenId: string): { completed: Token; next: Token | null; finished: boolean } => {
    const tokens = getStorageItem<Token[]>('tokens', []);
    const token = tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    token.status = 'completed';
    token.completed_at = new Date().toISOString();
    setStorageItem('tokens', tokens);

    // Log complete event
    const events = getStorageItem<QueueEvent[]>('queue_events', []);
    events.push({
      id: uuid(),
      token_id: tokenId,
      event_type: 'completed',
      department_id: token.department_id,
      actor: 'staff',
      metadata: {},
      created_at: new Date().toISOString()
    });
    setStorageItem('queue_events', events);

    // Rerouting Clinical Pathway logic
    const depts = mockDatabase.getDepartments();
    const currentDept = depts.find(d => d.id === token.department_id)!;
    const deptName = currentDept.name.toLowerCase();
    
    let nextDeptName = '';
    if (deptName.includes('reg')) nextDeptName = 'Billing';
    else if (deptName.includes('bill')) nextDeptName = 'Lab';
    else if (deptName.includes('lab')) nextDeptName = 'OPD Room 12';
    else if (deptName.includes('opd') || deptName.includes('room') || deptName.includes('doctor')) nextDeptName = 'Pharmacy';

    if (nextDeptName) {
      const nextDept = depts.find(d => d.name.toLowerCase().includes(nextDeptName.toLowerCase().split(' ')[0]))!;
      const deptTokens = tokens.filter((t) => t.department_id === nextDept.id);
      
      const prefixes: Record<string, string> = { billing: 'BIL', lab: 'LAB', 'opd room 12': 'OPD', pharmacy: 'PHA' };
      const prefix = prefixes[nextDept.name.toLowerCase()] || 'TKN';
      const tokenNumber = `${prefix}-${deptTokens.length + 101}`;

      const nextToken: Token = {
        id: uuid(),
        patient_id: token.patient_id,
        appointment_id: token.appointment_id,
        department_id: nextDept.id,
        token_number: tokenNumber,
        status: 'waiting',
        is_urgent: false,
        created_at: new Date().toISOString(),
        called_at: null,
        completed_at: null
      };

      tokens.push(nextToken);
      setStorageItem('tokens', tokens);

      events.push({
        id: uuid(),
        token_id: nextToken.id,
        event_type: 'created',
        department_id: nextDept.id,
        actor: 'system',
        metadata: {},
        created_at: new Date().toISOString()
      });
      setStorageItem('queue_events', events);

      const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
      const nextMsg = `Completed at ${currentDept.name}. Proceed to ${nextDept.name}, Floor ${nextDept.floor}, ${nextDept.room_number}. Token: ${tokenNumber}`;
      alerts.push({
        id: uuid(),
        token_id: nextToken.id,
        channel: 'in_app',
        message: nextMsg,
        sent_at: new Date().toISOString(),
        status: 'pending'
      });
      alerts.push({
        id: uuid(),
        token_id: nextToken.id,
        channel: 'sms',
        message: nextMsg,
        sent_at: new Date().toISOString(),
        status: 'pending'
      });
      setStorageItem('alerts_log', alerts);

      return {
        completed: mockDatabase.getToken(tokenId)!,
        next: mockDatabase.getToken(nextToken.id)!,
        finished: false
      };
    }

    // Finished OPD pathway (Pharmacy done)
    const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
    const finalMsg = `Your hospital visit is complete! Thank you for using Curaa.`;
    alerts.push({
      id: uuid(),
      token_id: tokenId,
      channel: 'sms',
      message: finalMsg,
      sent_at: new Date().toISOString(),
      status: 'pending'
    });
    setStorageItem('alerts_log', alerts);

    return {
      completed: mockDatabase.getToken(tokenId)!,
      next: null,
      finished: true
    };
  },

  skip: (tokenId: string, reason: string): Token => {
    const tokens = getStorageItem<Token[]>('tokens', []);
    const token = tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    token.status = 'skipped';
    setStorageItem('tokens', tokens);

    // Log skip event
    const events = getStorageItem<QueueEvent[]>('queue_events', []);
    events.push({
      id: uuid(),
      token_id: tokenId,
      event_type: 'skipped',
      department_id: token.department_id,
      actor: 'staff',
      metadata: { reason },
      created_at: new Date().toISOString()
    });
    setStorageItem('queue_events', events);

    // Queue alert for skip
    const alerts = getStorageItem<AlertLog[]>('alerts_log', []);
    const skipMsg = `Your token ${token.token_number} was skipped because: "${reason}". Please approach the staff counter.`;
    alerts.push({
      id: uuid(),
      token_id: tokenId,
      channel: 'in_app',
      message: skipMsg,
      sent_at: new Date().toISOString(),
      status: 'pending'
    });
    alerts.push({
      id: uuid(),
      token_id: tokenId,
      channel: 'sms',
      message: skipMsg,
      sent_at: new Date().toISOString(),
      status: 'pending'
    });
    setStorageItem('alerts_log', alerts);

    return mockDatabase.getToken(tokenId)!;
  },

  toggleUrgent: (tokenId: string): Token => {
    const tokens = getStorageItem<Token[]>('tokens', []);
    const token = tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error('Token not found');

    token.is_urgent = !token.is_urgent;
    setStorageItem('tokens', tokens);

    // Log event
    const events = getStorageItem<QueueEvent[]>('queue_events', []);
    events.push({
      id: uuid(),
      token_id: tokenId,
      event_type: 'rerouted',
      department_id: token.department_id,
      actor: 'staff',
      metadata: { priority: token.is_urgent ? 'urgent' : 'normal' },
      created_at: new Date().toISOString()
    });
    setStorageItem('queue_events', events);

    return mockDatabase.getToken(tokenId)!;
  },

  toggleBottleneck: (departmentId: string): Department => {
    const depts = getStorageItem<Department[]>('departments', DEPARTMENTS);
    const dept = depts.find((d) => d.id === departmentId);
    if (!dept) throw new Error('Department not found');

    dept.is_bottleneck = !dept.is_bottleneck;
    setStorageItem('departments', depts);
    return dept;
  },

  getAdminKPIs: () => {
    const tokens = mockDatabase.getTokens();
    const completed = tokens.filter(t => t.status === 'completed');
    const skipped = tokens.filter(t => t.status === 'skipped');

    // Calculate wait times
    let totalWaitMs = 0;
    let waitCount = 0;
    completed.forEach(t => {
      if (t.called_at) {
        const wait = new Date(t.called_at).getTime() - new Date(t.created_at).getTime();
        if (wait > 0) {
          totalWaitMs += wait;
          waitCount++;
        }
      }
    });
    const avgWait = waitCount > 0 ? Math.round(totalWaitMs / (waitCount * 60000)) : 12;

    // Station wait times chart
    const depts = mockDatabase.getDepartments();
    const deptMap: Record<string, { sum: number; count: number }> = {};
    depts.forEach(d => {
      deptMap[d.name] = { sum: 0, count: 0 };
    });

    completed.forEach(t => {
      if (t.departments && t.called_at) {
        const wait = new Date(t.called_at).getTime() - new Date(t.created_at).getTime();
        if (wait > 0 && deptMap[t.departments.name]) {
          deptMap[t.departments.name].sum += wait;
          deptMap[t.departments.name].count++;
        }
      }
    });

    const chartData = depts.map(d => {
      const cell = deptMap[d.name];
      const avg = cell.count > 0 ? Math.round(cell.sum / (cell.count * 60000)) : 0;
      const demoVal: Record<string, number> = {
        'Registration': 4,
        'Billing': 6,
        'Lab': 18,
        'OPD Room 12': 22,
        'Pharmacy': 8
      };
      return {
        name: d.name === 'OPD Room 12' ? 'Consultation' : d.name,
        'Average Wait (Mins)': avg || demoVal[d.name] || 5,
        color: d.color_code
      };
    });

    // Hourly chart data (9 AM to 5 PM)
    const hourMap: Record<number, number> = {};
    for (let h = 9; h <= 17; h++) hourMap[h] = 0;

    tokens.forEach(t => {
      const hr = new Date(t.created_at).getHours();
      if (hr >= 9 && hr <= 17) {
        hourMap[hr]++;
      }
    });

    const demoCurve: Record<number, number> = {
      9: 4, 10: 12, 11: 24, 12: 18, 13: 8, 14: 15, 15: 22, 16: 14, 17: 5
    };

    const timeData = Object.keys(hourMap).map(key => {
      const h = Number(key);
      const label = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`;
      return {
        hour: label,
        'Patient Volume': hourMap[h] || demoCurve[h]
      };
    });

    return {
      metrics: {
        totalTokens: tokens.length || 25,
        completed: completed.length || 18,
        skipped: skipped.length || 3,
        avgWaitMinutes: avgWait
      },
      chartData,
      timeData,
      allTokens: tokens
    };
  }
};
