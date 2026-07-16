import { Router, Request, Response } from 'express';
import { supabase } from './db';
import { askAgent } from './agent';

const router = Router();

// Helper: Get department prefix for token numbers
function getDeptPrefix(deptName: string): string {
  const name = deptName.toLowerCase();
  if (name.includes('reg')) return 'REG';
  if (name.includes('bill')) return 'BIL';
  if (name.includes('lab')) return 'LAB';
  if (name.includes('opd') || name.includes('room') || name.includes('doctor')) return 'OPD';
  if (name.includes('pharm') || name.includes('med')) return 'PHA';
  return 'TKN';
}

// Helper: Queue alert message
async function queueAlert(tokenId: string, message: string, channel: 'sms' | 'whatsapp' | 'in_app' = 'sms') {
  try {
    const { data, error } = await supabase
      .from('alerts_log')
      .insert({
        token_id: tokenId,
        channel,
        message,
        status: 'pending',
        sent_at: new Date().toISOString()
      })
      .select();
    
    if (error) throw error;
    console.log(`Alert queued for token ${tokenId}: "${message}"`);
    return data;
  } catch (err) {
    console.error('Failed to queue alert:', err);
  }
}

// 1. Patient Check-in
// QR Scan or manual entry -> generates patient & registration token
router.post('/check-in', async (req: Request, res: Response) => {
  const { name, phone, preferred_language, doctor_name } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required.' });
  }

  try {
    // 1. Get or Create Patient
    let patientId: string;
    const { data: existingPatients, error: pError } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', phone)
      .limit(1);

    if (pError) throw pError;

    if (existingPatients && existingPatients.length > 0) {
      patientId = existingPatients[0].id;
      // Update preferred language if changed
      await supabase
        .from('patients')
        .update({ preferred_language: preferred_language || 'en' })
        .eq('id', patientId);
    } else {
      const { data: newPatient, error: createPError } = await supabase
        .from('patients')
        .insert({ name, phone, preferred_language: preferred_language || 'en' })
        .select()
        .single();
      
      if (createPError) throw createPError;
      patientId = newPatient.id;
    }

    // 2. Find Registration Department
    const { data: regDept, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .ilike('name', '%Registration%')
      .limit(1)
      .single();

    if (deptError || !regDept) {
      return res.status(500).json({ error: 'Registration department not found. Run migrations & seeds.' });
    }

    // 3. Create Appointment if Doctor name is provided
    let appointmentId = null;
    if (doctor_name) {
      // Find OPD Room 12 department or default to REG for appointment record
      const { data: opdDept } = await supabase
        .from('departments')
        .select('id')
        .ilike('name', '%OPD%')
        .limit(1)
        .single();

      const { data: newAppt, error: apptError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          doctor_name,
          department_id: opdDept?.id || regDept.id,
          scheduled_time: new Date().toISOString(),
          status: 'checked_in'
        })
        .select()
        .single();

      if (apptError) throw apptError;
      appointmentId = newAppt.id;
    }

    // 4. Generate Token Number
    const { count, error: countError } = await supabase
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', regDept.id);

    if (countError) throw countError;

    const tokenIndex = (count || 0) + 101;
    const tokenNumber = `${getDeptPrefix(regDept.name)}-${tokenIndex}`;

    // 5. Create Registration Token
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .insert({
        patient_id: patientId,
        appointment_id: appointmentId,
        department_id: regDept.id,
        token_number: tokenNumber,
        status: 'waiting'
      })
      .select()
      .single();

    if (tokenError) throw tokenError;

    // 6. Log event in queue_events
    await supabase.from('queue_events').insert({
      token_id: token.id,
      event_type: 'created',
      department_id: regDept.id,
      actor: 'patient',
      metadata: { source: 'web_check_in' }
    });

    // Queue in-app and SMS alert
    await queueAlert(
      token.id,
      `Welcome ${name}! Your token for Registration is ${tokenNumber}. Please wait in the main lobby.`,
      'in_app'
    );
    await queueAlert(
      token.id,
      `Welcome ${name}! Token ${tokenNumber} generated. Registration is at Floor ${regDept.floor}, ${regDept.room_number}.`
    );

    return res.status(201).json(token);
  } catch (err: any) {
    console.error('Error checking in:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Staff Call Next Token
router.post('/staff/call-next', async (req: Request, res: Response) => {
  const { staffId } = req.body;

  if (!staffId) {
    return res.status(400).json({ error: 'Staff ID is required.' });
  }

  try {
    // 1. Fetch Staff Department
    const { data: staffMember, error: staffError } = await supabase
      .from('staff')
      .select('*, departments(*)')
      .eq('id', staffId)
      .single();

    if (staffError || !staffMember) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    const deptId = staffMember.department_id;
    const deptName = staffMember.departments.name;
    const floor = staffMember.departments.floor;
    const roomNumber = staffMember.departments.room_number;

    // 2. Fetch the next waiting token (Prioritize urgent tokens)
    const { data: nextToken, error: tokenError } = await supabase
      .from('tokens')
      .select('*, patients(*)')
      .eq('department_id', deptId)
      .eq('status', 'waiting')
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (tokenError) throw tokenError;

    if (!nextToken || nextToken.length === 0) {
      return res.status(200).json({ message: 'No waiting patients in this department.' });
    }

    const token = nextToken[0];

    // 3. Mark current called token as called
    const { data: updatedToken, error: updateError } = await supabase
      .from('tokens')
      .update({
        status: 'called',
        called_at: new Date().toISOString()
      })
      .eq('id', token.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Log event
    await supabase.from('queue_events').insert({
      token_id: token.id,
      event_type: 'called',
      department_id: deptId,
      actor: 'staff',
      metadata: { called_by: staffMember.name }
    });

    // 5. Send Alert to the patient being called
    const callMsg = `Token ${token.token_number} (${token.patients.name}) is called! Proceed to ${deptName}, Floor ${floor}, ${roomNumber}.`;
    await queueAlert(token.id, callMsg, 'sms');
    await queueAlert(token.id, callMsg, 'in_app');

    // 6. Notify next 3 patients in the queue (within N tokens alert)
    const { data: upcomingTokens } = await supabase
      .from('tokens')
      .select('*, patients(*)')
      .eq('department_id', deptId)
      .eq('status', 'waiting')
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(3);

    if (upcomingTokens && upcomingTokens.length > 0) {
      for (let i = 0; i < upcomingTokens.length; i++) {
        const upToken = upcomingTokens[i];
        const ahead = i + 1;
        const alertMsg = `Hi ${upToken.patients.name}, you are ${ahead} patient${ahead > 1 ? 's' : ''} away in the ${deptName} queue. Please head to Floor ${floor}, ${roomNumber}.`;
        await queueAlert(upToken.id, alertMsg, 'sms');
      }
    }

    return res.status(200).json(updatedToken);
  } catch (err: any) {
    console.error('Error calling next patient:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. Staff Skip Token (Patient not present)
router.post('/staff/skip', async (req: Request, res: Response) => {
  const { tokenId, reason } = req.body;

  if (!tokenId) {
    return res.status(400).json({ error: 'Token ID is required.' });
  }

  try {
    const { data: oldToken } = await supabase.from('tokens').select('*, patients(*)').eq('id', tokenId).single();
    if (!oldToken) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    const { data: token, error } = await supabase
      .from('tokens')
      .update({ status: 'skipped' })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('queue_events').insert({
      token_id: tokenId,
      event_type: 'skipped',
      department_id: token.department_id,
      actor: 'staff',
      metadata: { reason: reason || 'Patient not present' }
    });

    const skipMsg = `Your token ${token.token_number} was skipped because you were not present. Please approach the staff counter.`;
    await queueAlert(tokenId, skipMsg, 'sms');
    await queueAlert(tokenId, skipMsg, 'in_app');

    return res.status(200).json(token);
  } catch (err: any) {
    console.error('Error skipping patient:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 4. Staff Complete Token & Route to Next Department
router.post('/staff/complete', async (req: Request, res: Response) => {
  const { tokenId } = req.body;

  if (!tokenId) {
    return res.status(400).json({ error: 'Token ID is required.' });
  }

  try {
    // 1. Fetch current token and department
    const { data: currentToken, error: fetchError } = await supabase
      .from('tokens')
      .select('*, departments(*), patients(*)')
      .eq('id', tokenId)
      .single();

    if (fetchError || !currentToken) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    // 2. Update status of completed token
    const { data: updatedToken, error: updateError } = await supabase
      .from('tokens')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', tokenId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log complete event
    await supabase.from('queue_events').insert({
      token_id: tokenId,
      event_type: 'completed',
      department_id: currentToken.department_id,
      actor: 'staff'
    });

    // 3. Determine Next Department in clinical flow
    // Order: Registration -> Billing -> Lab (if appointment says, or default for demo) -> OPD Doctor -> Pharmacy
    const deptName = currentToken.departments.name.toLowerCase();
    let nextDeptName = '';
    
    if (deptName.includes('reg')) {
      nextDeptName = 'Billing';
    } else if (deptName.includes('bill')) {
      // Demo script path includes a bottleneck in Lab, so we proceed to Lab
      nextDeptName = 'Lab';
    } else if (deptName.includes('lab')) {
      nextDeptName = 'OPD Room 12';
    } else if (deptName.includes('opd') || deptName.includes('doctor')) {
      nextDeptName = 'Pharmacy';
    }

    // If there is a next department, route the patient there
    if (nextDeptName) {
      const { data: nextDept, error: nextDeptError } = await supabase
        .from('departments')
        .select('*')
        .ilike('name', `%${nextDeptName}%`)
        .limit(1)
        .single();

      if (nextDeptError || !nextDept) {
        return res.status(500).json({ error: `Next department (${nextDeptName}) not found. Verify seed script.` });
      }

      // Generate token count and token number
      const { count } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', nextDept.id);

      const nextTokenNum = `${getDeptPrefix(nextDept.name)}-${(count || 0) + 101}`;

      // Insert new token in next department
      const { data: nextToken, error: createError } = await supabase
        .from('tokens')
        .insert({
          patient_id: currentToken.patient_id,
          appointment_id: currentToken.appointment_id,
          department_id: nextDept.id,
          token_number: nextTokenNum,
          status: 'waiting'
        })
        .select()
        .single();

      if (createError) throw createError;

      // Log creation
      await supabase.from('queue_events').insert({
        token_id: nextToken.id,
        event_type: 'created',
        department_id: nextDept.id,
        actor: 'system'
      });

      // Send alert about new token
      const nextMsg = `Completed at ${currentToken.departments.name}. Proceed to ${nextDept.name}, Floor ${nextDept.floor}, ${nextDept.room_number}. Token: ${nextTokenNum}`;
      await queueAlert(nextToken.id, nextMsg, 'sms');
      await queueAlert(nextToken.id, nextMsg, 'in_app');

      return res.status(200).json({
        completed: updatedToken,
        next: nextToken,
        finished: false
      });
    }

    // No next department (completed Pharmacy)
    const finalMsg = `Thank you ${currentToken.patients.name}. Your hospital visit is complete! You can view your visit summary.`;
    await queueAlert(tokenId, finalMsg, 'sms');
    await queueAlert(tokenId, finalMsg, 'in_app');

    // Update appointment status to completed if applicable
    if (currentToken.appointment_id) {
      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', currentToken.appointment_id);
    }

    return res.status(200).json({
      completed: updatedToken,
      next: null,
      finished: true
    });
  } catch (err: any) {
    console.error('Error completing token:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 5. Staff Toggle Priority / Mark Urgent
router.post('/staff/toggle-urgent', async (req: Request, res: Response) => {
  const { tokenId } = req.body;

  if (!tokenId) {
    return res.status(400).json({ error: 'Token ID is required.' });
  }

  try {
    const { data: currentToken } = await supabase.from('tokens').select('is_urgent').eq('id', tokenId).single();
    if (!currentToken) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    const { data: token, error } = await supabase
      .from('tokens')
      .update({ is_urgent: !currentToken.is_urgent })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('queue_events').insert({
      token_id: tokenId,
      event_type: 'rerouted',
      department_id: token.department_id,
      actor: 'staff',
      metadata: { priority_change: token.is_urgent ? 'high' : 'normal' }
    });

    return res.status(200).json(token);
  } catch (err: any) {
    console.error('Error toggling priority:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 6. Patient Chat Assistant (AI Grounded Agent)
router.post('/chat', async (req: Request, res: Response) => {
  const { tokenId, message } = req.body;

  if (!tokenId || !message) {
    return res.status(400).json({ error: 'Token ID and message are required.' });
  }

  try {
    // 1. Fetch current token details
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select('*, departments(*), patients(*)')
      .eq('id', tokenId)
      .single();

    if (tokenError || !token) {
      return res.status(404).json({ error: 'Token not found.' });
    }

    const deptId = token.department_id;

    // 2. Fetch queue position (count waiting tokens with earlier created_at times + active called token)
    const { data: waitingTokens } = await supabase
      .from('tokens')
      .select('id, created_at, status, is_urgent')
      .eq('department_id', deptId)
      .in('status', ['waiting', 'called', 'in_progress'])
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: true });

    let position = 0;
    if (waitingTokens) {
      const index = waitingTokens.findIndex(t => t.id === tokenId);
      position = index >= 0 ? index : waitingTokens.length;
    }

    const estWait = position * token.departments.avg_service_time_minutes;

    // 3. Construct Patient Context
    const contextState = {
      patientName: token.patients.name,
      tokenNumber: token.token_number,
      deptName: token.departments.name,
      roomNumber: token.departments.room_number,
      floor: token.departments.floor,
      queuePosition: position,
      estWaitTime: estWait,
      isBottleneck: token.departments.is_bottleneck,
      language: token.patients.preferred_language
    };

    // 4. Invoke Claude Agent
    const reply = await askAgent(message, contextState);

    // Optional: Log chat interaction as system event
    await supabase.from('queue_events').insert({
      token_id: tokenId,
      event_type: 'rerouted', // generic categorizer for agent event
      department_id: deptId,
      actor: 'patient',
      metadata: { user_chat: message, agent_response: reply }
    });

    return res.status(200).json({ response: reply });
  } catch (err: any) {
    console.error('Error in chat assistant:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 7. Staff Bottleneck Toggle
router.post('/staff/toggle-bottleneck', async (req: Request, res: Response) => {
  const { departmentId } = req.body;

  if (!departmentId) {
    return res.status(400).json({ error: 'Department ID is required.' });
  }

  try {
    const { data: currentDept } = await supabase.from('departments').select('is_bottleneck').eq('id', departmentId).single();
    if (!currentDept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    const { data: dept, error } = await supabase
      .from('departments')
      .update({ is_bottleneck: !currentDept.is_bottleneck })
      .eq('id', departmentId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json(dept);
  } catch (err: any) {
    console.error('Error toggling bottleneck:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
