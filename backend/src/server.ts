import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import router from './routes';
import { supabase } from './db';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS & JSON Parsing
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', router);

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hospital Queue Navigator API is running.');
});

// Start Express Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Rate-limited Alert Queue Worker
// Processes "pending" messages from alerts_log at a limited rate to avoid provider throttling
const BATCH_SIZE = 2; // Process 2 alerts at a time
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

async function processAlertsQueue() {
  try {
    // 1. Fetch pending alerts
    const { data: pendingAlerts, error } = await supabase
      .from('alerts_log')
      .select('*, tokens(*, patients(*))')
      .eq('status', 'pending')
      .order('sent_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Error fetching pending alerts:', error.message);
      return;
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return;
    }

    console.log(`[Alert Worker] Processing ${pendingAlerts.length} pending alerts...`);

    for (const alert of pendingAlerts) {
      const { channel, message, id, tokens } = alert;
      const phone = tokens?.patients?.phone;
      const patientName = tokens?.patients?.name;

      let isSuccess = true;

      if (channel === 'in_app') {
        // In-app notifications are processed instantly via real-time DB changes
        console.log(`[Alert Worker] [IN-APP ALERT] For: ${patientName}. Message: "${message}"`);
      } else {
        // SMS or WhatsApp alerts
        console.log(`[Alert Worker] [SMS/WHATSAPP ALERT] Sending via Twilio to ${phone || 'N/A'}: "${message}"`);
        
        // Twilio integration
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        if (accountSid && authToken && twilioPhone && phone) {
          try {
            // Lazy load Twilio client to keep dependencies light
            const twilio = require('twilio');
            const client = twilio(accountSid, authToken);
            await client.messages.create({
              body: message,
              from: twilioPhone,
              to: phone
            });
            console.log(`[Alert Worker] Successfully sent Twilio SMS to ${phone}`);
          } catch (twilioErr: any) {
            console.error(`[Alert Worker] Twilio failed for alert ${id}:`, twilioErr.message);
            isSuccess = false;
          }
        } else {
          console.log(`[Alert Worker] Twilio credentials not configured. Simulating successful dispatch.`);
        }
      }

      // Update alert status
      await supabase
        .from('alerts_log')
        .update({ status: isSuccess ? 'sent' : 'failed' })
        .eq('id', id);
    }
  } catch (err: any) {
    console.error('[Alert Worker] Unexpected error in queue processing:', err.message);
  }
}

// Start background worker loop
setInterval(processAlertsQueue, POLL_INTERVAL_MS);
console.log(`[Alert Worker] Initialized. Checking queue every ${POLL_INTERVAL_MS / 1000}s (Batch size: ${BATCH_SIZE})`);
export default app;
