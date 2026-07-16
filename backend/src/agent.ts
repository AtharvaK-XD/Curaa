import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client if key is present
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

interface PatientState {
  patientName: string;
  tokenNumber: string;
  deptName: string;
  roomNumber: string;
  floor: number;
  queuePosition: number;
  estWaitTime: number;
  isBottleneck: boolean;
  language: 'en' | 'hi' | 'gu';
}

export async function askAgent(message: string, state: PatientState): Promise<string> {
  const systemPrompt = `You are the Hospital Queue Navigator Assistant for City General Hospital.
Your role is to help patients navigate their outpatient department (OPD) visit. You only answer questions about logistics, workflow, room numbers, floors, queue positions, and estimated wait times.

Here is the current patient's context:
- Patient Name: ${state.patientName}
- Token Number: ${state.tokenNumber}
- Current Department: ${state.deptName}
- Room Number: ${state.roomNumber}
- Floor: ${state.floor}
- Queue Position: ${state.queuePosition} (Patients ahead: ${state.queuePosition})
- Estimated Wait Time: ${state.estWaitTime} minutes
- Department Bottleneck Active: ${state.isBottleneck ? 'YES' : 'NO'}

Hospital Workflow Sequence:
1. Registration (Floor 1, Counter 1) -> Color: Blue
2. Billing (Floor 1, Counter 2) -> Color: Teal
3. Lab (Floor 2, Room 201) -> Color: Purple
4. OPD Room 12 (Floor 3, Room 305) -> Color: Emerald
5. Pharmacy (Floor 1, Counter 3) -> Color: Rose

Rules:
1. Detect and respond in the same language the user queried you in. Support English, Hindi, and Gujarati.
2. Constrain yourself strictly to logistics, queue status, locations, and workflows.
3. NEVER give any medical, diagnosis, treatment, symptom-checking, or prescription advice. If asked any medical questions, politely refuse and state that you are a queue navigation assistant, not a doctor.
4. Keep your answers brief, warm, clear, and reassuring, as patients might be anxious or elderly.
5. If the Department Bottleneck is active, explain that there is currently a delay in that department, but they are in the queue and will be served as soon as possible.
`;

  // If Anthropic is not configured, use a rule-based multilingual fallback
  if (!anthropic) {
    console.log('Anthropic API key not configured. Using high-quality local fallback.');
    return getLocalMockResponse(message, state);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const block = response.content[0];
    if (block.type === 'text') {
      return block.text;
    }
    return 'I am here to help you navigate the hospital queue. How can I assist you today?';
  } catch (error) {
    console.error('Anthropic API call failed:', error);
    return getLocalMockResponse(message, state);
  }
}

// Multilingual Rule-based Mock Assistant
function getLocalMockResponse(message: string, state: PatientState): string {
  const lowercaseMsg = message.toLowerCase();
  
  // Detect language
  let lang: 'en' | 'hi' | 'gu' = 'en';
  if (/कहाँ|समय|कब|मेरा|डॉक्टर|दवाई|कैसे|नमस्ते/.test(message)) {
    lang = 'hi';
  } else if (/ક્યાં|સમય|ક્યારે|મારો|દવા|કેવી|નમસ્તે/.test(message)) {
    lang = 'gu';
  } else {
    lang = state.language || 'en';
  }

  // Check for medical queries (refusal check)
  const medicalKeywords = [
    'pain', 'fever', 'headache', 'medicine', 'prescription', 'cough', 'sick', 'diagnose', 'symptom', 'disease', 'cure',
    'दर्द', 'बुखार', 'सिरदर्द', 'दवा', 'बीमार', 'खांसी', 'इलाज', 'लक्षण',
    'દુખાવો', 'તાવ', 'માથું', 'દવા', 'બીમાર', 'ખાંસી', 'ઈલાજ', 'લક્ષણો'
  ];
  if (medicalKeywords.some(kw => lowercaseMsg.includes(kw))) {
    if (lang === 'hi') {
      return `मैं एक कतार नेविगेशन सहायक हूँ और चिकित्सा या नैदानिक सलाह नहीं दे सकता। कृपया अपने डॉक्टर से परामर्श करें या आपातकालीन चिकित्सा सहायता लें।`;
    } else if (lang === 'gu') {
      return `હું માત્ર કતાર નેવિગેશન સહાયક છું અને તબીબી અથવા નિદાન સલાહ આપી શકતો નથી. કૃપા કરીને તમારા ડૉક્ટરની સલાહ લો અથવા કટોકટીની તબીબી સહાય મેળવો.`;
    } else {
      return `I am only a queue navigation assistant and cannot provide medical or diagnostic advice. Please consult your doctor directly or seek emergency medical help.`;
    }
  }

  // Check for "where do I go" / room / location questions
  const locationKeywords = [
    'where', 'go', 'room', 'floor', 'counter', 'location',
    'कहाँ', 'कमरा', 'मंजिल', 'स्थान', 'काउंटर', 'जाना',
    'ક્યાં', 'રૂમ', 'માળ', 'સ્થાન', 'કાઉન્ટર', 'જવું'
  ];
  if (locationKeywords.some(kw => lowercaseMsg.includes(kw))) {
    if (lang === 'hi') {
      return `नमस्ते ${state.patientName}! आपका वर्तमान टोकन ${state.tokenNumber} है। आपको ${state.deptName} विभाग में जाना है, जो मंजिल ${state.floor}, ${state.roomNumber} पर स्थित है।`;
    } else if (lang === 'gu') {
      return `નમસ્તે ${state.patientName}! તમારો વર્તમાન ટોકન ${state.tokenNumber} છે. તમારે ${state.deptName} વિભાગમાં જવાનું છે, જે માળ ${state.floor}, ${state.roomNumber} પર આવેલ છે.`;
    } else {
      return `Hello ${state.patientName}! Your current token is ${state.tokenNumber}. Please proceed to the ${state.deptName} department, located on Floor ${state.floor}, at ${state.roomNumber}.`;
    }
  }

  // Check for "how much longer" / wait time / position questions
  const waitKeywords = [
    'how long', 'wait', 'time', 'position', 'queue', 'when',
    'कितना समय', 'कब', 'इंतजार', 'कतार', 'नंबर', 'देरी',
    'કેટલો સમય', 'ક્યારે', 'રાહ', 'કતાર', 'નંબર', 'વિલંબ'
  ];
  if (waitKeywords.some(kw => lowercaseMsg.includes(kw))) {
    let bottleneckWarning = '';
    if (state.isBottleneck) {
      if (lang === 'hi') {
        bottleneckWarning = ` ध्यान दें: इस विभाग में वर्तमान में कुछ अतिरिक्त देरी हो रही है।`;
      } else if (lang === 'gu') {
        bottleneckWarning = ` ધ્યાન આપો: આ વિભાગમાં હાલમાં થોડો વધારાનો વિલંબ છે.`;
      } else {
        bottleneckWarning = ` Note: There is currently an active bottleneck causing delays in this department.`;
      }
    }

    if (lang === 'hi') {
      return `आपका टोकन ${state.tokenNumber} है। आपसे आगे ${state.queuePosition} मरीज हैं। आपका अनुमानित प्रतीक्षा समय लगभग ${state.estWaitTime} मिनट है।${bottleneckWarning} कृपया प्रतीक्षा क्षेत्र में रहें, जब आपका नंबर आएगा तो आपको सूचित किया जाएगा।`;
    } else if (lang === 'gu') {
      return `તમારો ટોકન ${state.tokenNumber} છે. તમારી આગળ ${state.queuePosition} દર્દીઓ છે. તમારો અંદાજિત પ્રતીક્ષા સમય લગભગ ${state.estWaitTime} મિનિટ છે.${bottleneckWarning} કૃપા કરીને પ્રતીક્ષા વિસ્તારમાં રહો, જ્યારે તમારો નંબર આવશે ત્યારે તમને જાણ કરવામાં આવશે.`;
    } else {
      return `Your token is ${state.tokenNumber}. There are ${state.queuePosition} patients ahead of you. Your estimated wait time is approximately ${state.estWaitTime} minutes.${bottleneckWarning} Please remain in the waiting area, you will be notified when called.`;
    }
  }

  // General fallback
  if (lang === 'hi') {
    return `नमस्ते ${state.patientName}, मैं आपकी किस प्रकार सहायता कर सकता हूँ? आप मुझसे अपने टोकन (${state.tokenNumber}), विभाग (${state.deptName}), या प्रतीक्षा समय के बारे में पूछ सकते हैं।`;
  } else if (lang === 'gu') {
    return `નમસ્તે ${state.patientName}, હું તમને કેવી રીતે મદદ કરી શકું? તમે મને તમારા ટોકન (${state.tokenNumber}), વિભાગ (${state.deptName}), અથવા પ્રતીક્ષા સમય વિશે પૂછી શકો છો.`;
  } else {
    return `Hello ${state.patientName}, how can I help you navigate today? You can ask me about your token (${state.tokenNumber}), current department (${state.deptName}), or estimated wait time.`;
  }
}
