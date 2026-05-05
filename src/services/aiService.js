const config = require('../config');
const logger = require('../utils/logger');
const sessionStore = require('../utils/sessionStore');
const intentService = require('./intentService');
const { detectEmotion } = require('./emotionService');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Mapping languageCode to specific language names as required
const languageNames = {
  'ta-IN': 'Tamil',
  'hi-IN': 'Hindi',
  'kn-IN': 'Kannada',
  'en-IN': 'English'
};

const fallbacks = {
  'en-IN': 'Sorry, I am having trouble. Please try again.',
  'hi-IN': 'नमस्ते, मैं अभी सहायता नहीं कर पा रहा हूँ। कृपया फिर से प्रयास करें।',
  'ta-IN': 'மன்னிக்கவும், நான் இப்போது சில சிக்கல்களை எதிர்கொள்கிறேன். தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
  'kn-IN': 'ಕ್ಷಮಿಸಿ, ನಾನು ಇತೀಗ ತೊಂದರೆಯಲ್ಲಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'
};

function hasExpectedScript(text, languageCode) {
  if (!text) return false;
  if (languageCode === 'en-IN') {
    // Just make sure it contains some text
    return true;
  }
  if (languageCode === 'ta-IN') {
    // Check for Tamil Unicode range
    return /[\u0B80-\u0BFF]/.test(text);
  }
  if (languageCode === 'hi-IN') {
    // Check for Devanagari (Hindi) Unicode range
    return /[\u0900-\u097F]/.test(text);
  }
  if (languageCode === 'kn-IN') {
    // Check for Kannada Unicode range
    return /[\u0C80-\u0CFF]/.test(text);
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// HYBRID SINGLE-CALL: Emotion + Intent + Dialect + Urgency + Response in ONE GPT call
// ──────────────────────────────────────────────────────────────

async function analyzeAndRespond({ userText, languageCode, callSid }) {
  try {
    if (!config.groqApiKey) {
      throw new Error('GROQ_API_KEY is missing');
    }

    const langName = languageNames[languageCode] || 'English';
    const session = callSid ? sessionStore.getSessionState(callSid) : null;
    const entitiesJson = session ? JSON.stringify(session.entities) : '{}';
    const stage = session ? session.stage : 'intent_detection';
    const previousIntent = session ? (session.intent || 'none') : 'none';
    const previousEmotion = session?.emotion || 'neutral';

    // Get memory context (summary + facts + recent messages)
    const memory = callSid ? sessionStore.getSummaryContext(callSid) : { summary: '', facts: {}, recentMessages: [], turnCount: 0 };
    const memorySummary = memory.summary || '';
    const memoryFacts = Object.keys(memory.facts).length > 0 ? JSON.stringify(memory.facts) : 'none';

    logger.info('Hybrid AI analysis starting', {
      callSid, languageCode, stage, previousIntent, turnCount: memory.turnCount,
      hasSummary: memorySummary.length > 0,
      promptPreview: String(userText).slice(0, 200),
      timestamp: new Date().toISOString()
    });

    const systemPrompt = `You are a smart ${langName} voice assistant on a government citizen helpline (1092 Karnataka).

TASK: Analyze the caller's message and respond with a JSON object.

You MUST return ONLY valid JSON in this exact format:
{
  "emotion": "neutral",
  "intent": "general",
  "intentConfidence": 0.5,
  "isSensitive": false,
  "isUrgent": false,
  "dialect": "standard",
  "dialectNotes": "",
  "restatement": "",
  "response": "Your helpful response here"
}

EMOTION — detect the caller's emotional state:
- "neutral" — normal conversation
- "happy" — sounds positive, grateful, laughing
- "distress" — sounds stressed, sad, troubled, mentions problems
- "high_distress" — extremely upset, mentions severe hardship
- "angry" — sounds frustrated, irritated, annoyed
- "confused" — sounds lost, unsure, asking "what?" or "how?"
- "fear" — sounds scared, worried, threatened, mentions danger or threat
- "urgency" — time-sensitive situation, emergency, needs immediate help

URGENCY (separate boolean flag — a calm person can have an urgent matter):
- true: medical emergency, accident, fire, immediate danger, time-critical government deadline, etc.
- false: general inquiry, non-time-sensitive matter

INTENT — categorize what the caller wants:
- Use short labels like: "legal_divorce", "road_complaint", "water_supply", "electricity_issue", "police_complaint", "pension_query", "corruption_report", "health_emergency", "education_query", "general_query", etc.
- Create a relevant label based on the actual topic — do NOT force into predefined categories
- "general" if you cannot determine a specific intent

INTENT CONFIDENCE:
- 1.0 = very clear intent, exact keywords used
- 0.7-0.9 = clear intent with some context
- 0.4-0.6 = somewhat clear, could be interpreted differently
- 0.1-0.3 = vague, unclear intent
- 0.0 = cannot determine intent at all

IS SENSITIVE:
- true for topics like: divorce, death, abuse, legal issues, medical emergencies, mental health, domestic violence, child abuse, sexual harassment
- false for normal queries

DIALECT DETECTION (especially for Kannada):
- "standard" — standard/formal language
- "north_karnataka" — Dharwad, Belgaum, Hubli region dialect (e.g., "ಏನ್ ಮಾಡ್ತೀರಿ", "ಬರ್ರಿ", "ಹೋಗ್ರಿ", "ಅಲ್ರಿ", use of "ರಿ" suffix)
- "south_karnataka" — Mysore, Mandya, Hassan region dialect (e.g., "ಏನ್ ಮಾಡ್ತೀಯ", "ಬಾರಯ್ಯ", "ಹೋಗಪ್ಪ")
- "coastal_karnataka" — Mangalore, Udupi region dialect (e.g., Tulu-influenced Kannada, "ಎಂಚ", "ಯಾನ್")
- "bangalore_urban" — Bangalore colloquial (code-mixed English-Kannada, "ಮಚ್ಚಿ", "ಏನ್ ಗುರು")
- "hyderabad_karnataka" — Gulbarga, Raichur region (Urdu-influenced, "ಏನ್ ಮಾಡ್ತಾರ")
- For Hindi: "standard", "bihari", "bhojpuri", "rajasthani", "deccani" (Hyderabad Hindi)
- For English: "standard", "regional_english" (heavy mother-tongue influence)
- For Tamil: "standard", "madurai", "chennai_colloquial", "sri_lankan"

DIALECT NOTES: Brief description of any colloquial expressions, local idioms, or regional phrases used by the caller. Leave empty if standard language.

RESTATEMENT: A concise 1-sentence restatement of the citizen's issue in the SAME language they spoke. This will be read back to verify understanding. Example: "You are facing a water supply problem in your area for the last 3 days." Leave empty if the input is too vague to restate.

RESPONSE RULES:
- Respond ONLY in ${langName}. Do NOT mix languages.
- Maximum 2 sentences.
- This is a GOVERNMENT HELPLINE — be professional, empathetic, and helpful.
- Adjust tone based on the detected emotion:
  → neutral: normal helpful tone
  → happy: friendly and appreciative
  → distress: calm, supportive, empathetic
  → high_distress: extra empathy, very calm
  → angry: calm, respectful, de-escalating
  → confused: explain clearly, guide step-by-step
  → fear: reassuring, protective, calming
  → urgency: immediate, action-oriented, prioritize help

OFF-TOPIC GUARDRAIL (VERY IMPORTANT):
- This is a GOVERNMENT HELPLINE for civic issues, complaints, and public services ONLY.
- If the caller asks about movies, entertainment, gossip, personal chat, jokes, fun facts, or anything NOT related to government services:
  → Set intent to "off_topic" with intentConfidence 0.9
  → Respond POLITELY redirecting them: "This is a government helpline for civic issues. I can help with complaints about roads, water, electricity, government services, etc. How can I help you with a civic matter?"
  → Do NOT engage with off-topic requests. Do NOT discuss movies, entertainment, etc.
- If the caller seems lonely and just wants to talk, be empathetic but redirect: "I understand. If you have any government-related issue or need help with a public service, I'm here to assist."

ANTI-REPETITION (CRITICAL):
- NEVER repeat the same response twice in a row.
- If you already said something similar, rephrase it completely or ask a specific question.
- Check the conversation history and DO NOT repeat phrases from your previous responses.
- Vary your language — use different words, different sentence structures.

COLLOQUIAL LANGUAGE:
- Callers will use informal, colloquial language — NOT textbook grammar.
- Tamil: "ஏதாச்சு" = ஏதாவது, "பேசுங்க" = பேசுங்கள், "பத்தி" = பற்றி, "சொல்லுங்க" = சொல்லுங்கள், "வேணாம்" = வேண்டாம், "இல்ல" = இல்லை
- Kannada: "ಮಾಡ್ತೀನಿ" = ಮಾಡುತ್ತೇನೆ, "ಹೇಳ್ರಿ" = ಹೇಳಿರಿ, "ಬರ್ರಿ" = ಬನ್ನಿ
- Hindi: "kya hai" = क्या है, "batao" = बताओ, "karo" = करो
- Understand and respond to colloquial forms just as well as formal ones.

CONVERSATION CONTEXT:
- Stage: ${stage}
- Previous intent: ${previousIntent}
- Previous emotion: ${previousEmotion}
- Entities: ${entitiesJson}
- Turn count: ${memory.turnCount}

MEMORY (what happened earlier in this call):
${memorySummary ? `Summary: ${memorySummary}` : 'No earlier context yet.'}
Facts: ${memoryFacts}

IMPORTANT MEMORY RULES:
- Use the summary and facts to stay consistent with the conversation
- Do NOT repeat questions that were already asked
- Do NOT forget preferences or decisions the user already shared
- Build on what was discussed earlier

STAGE BEHAVIOR:
- intent_detection: Understand what the user wants, respond helpfully
- confirmation: The user was asked to confirm something. Detect yes/no and respond accordingly.
- clarification: Ask exactly ONE clarifying question about the topic
- solution: Give a helpful suggestion + ONE follow-up question

CRITICAL: Return ONLY the JSON object. No markdown, no backticks, no explanation.`;

    // Append current user message to conversation history
    if (callSid) {
      sessionStore.appendToSession(callSid, { role: 'user', content: userText });
    }

    // Get conversation context
    const history = callSid ? sessionStore.getSession(callSid) : [{ role: 'user', content: userText }];
    const cleanHistory = history.slice(-6); // last 3 turns

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: config.groqModel,
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          ...cleanHistory
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${errorBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Groq');
    }

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      // Try extracting JSON from the response if it has extra text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse JSON: ${content.slice(0, 200)}`);
      }
    }

    // Validate and normalize the parsed result
    const result = {
      emotion: ['neutral', 'happy', 'distress', 'high_distress', 'angry', 'confused', 'fear', 'urgency'].includes(parsed.emotion)
        ? parsed.emotion : 'neutral',
      intent: typeof parsed.intent === 'string' && parsed.intent.length > 0
        ? parsed.intent : 'general',
      intentConfidence: typeof parsed.intentConfidence === 'number'
        ? Math.max(0, Math.min(1, parsed.intentConfidence)) : 0.5,
      isSensitive: Boolean(parsed.isSensitive),
      isUrgent: Boolean(parsed.isUrgent),
      dialect: typeof parsed.dialect === 'string' ? parsed.dialect : 'standard',
      dialectNotes: typeof parsed.dialectNotes === 'string' ? parsed.dialectNotes : '',
      restatement: typeof parsed.restatement === 'string' ? parsed.restatement.trim() : '',
      response: typeof parsed.response === 'string' ? parsed.response.trim() : ''
    };

    // Validate response language script
    if (result.response && !hasExpectedScript(result.response, languageCode)) {
      logger.warn('AI response did not match expected language script', {
        languageCode, response: result.response
      });
      result.response = fallbacks[languageCode] || fallbacks['en-IN'];
    }

    // Voice UX guard: prevent extremely long outputs
    if (result.response.length > 200) {
      result.response = result.response.slice(0, 200);
    }

    // Store dialect and urgency in session
    if (callSid) {
      sessionStore.updateSessionState(callSid, {
        dialect: result.dialect,
        dialectNotes: result.dialectNotes,
        isUrgent: result.isUrgent
      });
    }

    // Append AI response to context
    if (callSid && result.response) {
      sessionStore.appendToSession(callSid, { role: 'assistant', content: result.response });
    }

    logger.info('Hybrid AI analysis complete', {
      callSid, languageCode,
      emotion: result.emotion,
      intent: result.intent,
      intentConfidence: result.intentConfidence,
      isSensitive: result.isSensitive,
      isUrgent: result.isUrgent,
      dialect: result.dialect,
      dialectNotes: result.dialectNotes,
      restatement: result.restatement ? result.restatement.slice(0, 80) : '',
      responsePreview: result.response.slice(0, 100),
      timestamp: new Date().toISOString()
    });

    return result;

  } catch (error) {
    logger.error('Hybrid AI analysis failed — falling back to keyword detection', {
      callSid, languageCode,
      error: error?.message || String(error),
      timestamp: new Date().toISOString()
    });

    // ─── FALLBACK: Use keyword-based detection ───
    const normalizedInput = intentService.normalizeInput(userText);
    const keywordIntent = intentService.detectIntent(normalizedInput);
    const keywordEmotion = detectEmotion(userText, keywordIntent?.name || null);

    return {
      emotion: keywordEmotion || 'neutral',
      intent: keywordIntent ? keywordIntent.name : 'general',
      intentConfidence: keywordIntent ? keywordIntent.confidence : 0,
      isSensitive: keywordIntent ? keywordIntent.type === 'sensitive' : false,
      isUrgent: false,
      dialect: 'standard',
      dialectNotes: '',
      restatement: '',
      response: fallbacks[languageCode] || fallbacks['en-IN']
    };
  }
}

module.exports = {
  analyzeAndRespond
};
