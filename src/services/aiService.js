const config = require('../config');
const logger = require('../utils/logger');
const sessionStore = require('../utils/sessionStore');
const intentService = require('./intentService');
const { detectEmotion } = require('./emotionService');
const knowledgeBase = require('./knowledgeBase');

// ──────────────────────────────────────────────────────────────
// PROVIDER ENDPOINTS
// ──────────────────────────────────────────────────────────────
const PROVIDERS = {
  nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    keyEnv: 'nvidiaApiKey',
    defaultModel: 'sarvamai/sarvam-m'
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'groqApiKey',
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct'
  }
};

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
  if (languageCode === 'en-IN') return true;
  if (languageCode === 'ta-IN') return /[\u0B80-\u0BFF]/.test(text);
  if (languageCode === 'hi-IN') return /[\u0900-\u097F]/.test(text);
  if (languageCode === 'kn-IN') return /[\u0C80-\u0CFF]/.test(text);
  return true;
}

// Simple word-overlap similarity (0.0 = totally different, 1.0 = identical)
function getTextSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

// Strip hallucinated phone numbers from AI responses.
// Keeps ONLY numbers that exist in the knowledge base.
function stripHallucinatedPhoneNumbers(text) {
  if (!text) return text;
  // Match common Indian phone patterns: 080-XXXX-XXXX, +91XXXXXXXXXX, 1800-XXX-XXXX, 3-4 digit helplines
  const phoneRegex = /(\+91[\s-]?\d{5}[\s-]?\d{5}|0\d{2,4}[\s-]?\d{4,8}|1800[\s-]?\d{3}[\s-]?\d{3,4})/g;
  const knownNumbers = new Set();
  // Build set of all known numbers from knowledge base
  for (const dept of knowledgeBase.getAllDepartments()) {
    for (const phone of dept.phones) {
      knownNumbers.add(phone.replace(/[\s-]/g, ''));
    }
  }

  return text.replace(phoneRegex, (match) => {
    const normalized = match.replace(/[\s-]/g, '');
    if (knownNumbers.has(normalized)) return match; // keep known numbers
    return ''; // strip unknown/hallucinated numbers
  }).replace(/\s{2,}/g, ' ').trim();
}

// Robust JSON extraction using bracket counting (handles nested {} and trailing text)
function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

// ──────────────────────────────────────────────────────────────
// SMART PROVIDER CHAIN — NVIDIA first (if key exists), then Groq fallback
// ──────────────────────────────────────────────────────────────

function getProviderChain() {
  const chain = [];

  // Determine primary provider from config
  const primary = config.aiProvider || 'auto';

  // For 'auto' mode: Groq FIRST (fast ~1.5s) → NVIDIA fallback (slower but better quality)
  // Voice calls need speed — callers can't wait 16 seconds in silence

  if (primary === 'groq' || primary === 'auto') {
    if (config.groqApiKey) {
      // Primary Groq model (fastest)
      chain.push({
        name: 'groq',
        url: PROVIDERS.groq.url,
        apiKey: config.groqApiKey,
        model: config.groqModel || PROVIDERS.groq.defaultModel
      });
      // Groq fallback models (different rate limit pools)
      const groqFallbacks = [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant'
      ];
      for (const m of groqFallbacks) {
        if (m !== (config.groqModel || PROVIDERS.groq.defaultModel)) {
          chain.push({
            name: 'groq',
            url: PROVIDERS.groq.url,
            apiKey: config.groqApiKey,
            model: m
          });
        }
      }
    }
  }

  // NVIDIA Sarvam-M — best quality for Indian languages but slower (~10-16s)
  // Used as fallback when ALL Groq models are rate-limited
  if (primary === 'nvidia' || primary === 'auto') {
    if (config.nvidiaApiKey) {
      chain.push({
        name: 'nvidia',
        url: PROVIDERS.nvidia.url,
        apiKey: config.nvidiaApiKey,
        model: config.nvidiaModel || PROVIDERS.nvidia.defaultModel
      });
    }
  }

  if (chain.length === 0) {
    throw new Error('No AI provider configured. Set NVIDIA_API_KEY or GROQ_API_KEY in .env');
  }

  return chain;
}

// ──────────────────────────────────────────────────────────────
// API CALL WITH RETRY + PROVIDER FALLBACK
// ──────────────────────────────────────────────────────────────

async function callLLMWithFallback(messages, maxTokens = 512) {
  const chain = getProviderChain();
  let lastError = null;

  for (const provider of chain) {
    try {
      const result = await callProvider(provider, messages, maxTokens);
      return result;
    } catch (err) {
      lastError = err;
      const is429 = err.message?.includes('429');
      const is5xx = err.message?.includes('500') || err.message?.includes('503');

      if (is429 || is5xx) {
        // Extract retry delay from error if available
        const delayMatch = err.message.match(/try again in (\d+\.?\d*)s/i);
        const waitMs = delayMatch ? Math.ceil(parseFloat(delayMatch[1]) * 1000) : 2000;

        logger.warn(`Provider ${provider.name}/${provider.model} rate-limited, trying next`, {
          provider: provider.name, model: provider.model, waitMs
        });

        await new Promise(r => setTimeout(r, Math.min(waitMs, 3000)));
        continue;
      }

      logger.warn(`Provider ${provider.name}/${provider.model} failed, trying next`, {
        error: err.message?.slice(0, 150)
      });
      continue;
    }
  }

  throw lastError || new Error('All AI providers failed');
}

async function callProvider(provider, messages, maxTokens) {
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${provider.name} API returned ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  let content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`Empty response from ${provider.name}`);
  }

  // Strip <think>...</think> tags (complete AND truncated)
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  content = content.replace(/<think>[\s\S]*/g, '').trim();

  return { content, provider: provider.name, model: provider.model };
}

// ──────────────────────────────────────────────────────────────
// HYBRID SINGLE-CALL: Emotion + Intent + Dialect + Urgency + Response
// ──────────────────────────────────────────────────────────────

async function analyzeAndRespond({ userText, languageCode, callSid }) {
  try {
    if (!config.groqApiKey && !config.nvidiaApiKey) {
      throw new Error('No AI API key configured (set GROQ_API_KEY or NVIDIA_API_KEY)');
    }

    const langName = languageNames[languageCode] || 'English';
    const session = callSid ? sessionStore.getSessionState(callSid) : null;
    const entitiesJson = session ? JSON.stringify(session.entities) : '{}';
    const stage = session ? session.stage : 'intent_detection';
    const previousIntent = session ? (session.intent || 'none') : 'none';
    const previousEmotion = session?.emotion || 'neutral';

    // Get memory context
    const memory = callSid ? sessionStore.getSummaryContext(callSid) : { summary: '', facts: {}, recentMessages: [], turnCount: 0 };
    const memorySummary = memory.summary || '';
    const memoryFacts = Object.keys(memory.facts).length > 0 ? JSON.stringify(memory.facts) : 'none';

    logger.info('Hybrid AI analysis starting', {
      callSid, languageCode, stage, previousIntent, turnCount: memory.turnCount,
      hasSummary: memorySummary.length > 0,
      promptPreview: String(userText).slice(0, 200),
      timestamp: new Date().toISOString()
    });

    // Get last AI response to prevent repetition
    const lastAiResponse = callSid ? (sessionStore.getSessionState(callSid)?.lastAiResponse || '') : '';

    // ── COMPACT SYSTEM PROMPT ──
    const kbContext = knowledgeBase.getKnowledgeBaseForPrompt();
    const systemPrompt = `You are a ${langName} voice assistant on 1092 Karnataka Government Helpline.

Return ONLY valid JSON (no markdown, no explanation):
{"emotion":"neutral","intent":"general","intentConfidence":0.5,"isSensitive":false,"isUrgent":false,"dialect":"standard","dialectNotes":"","restatement":"","response":""}

FIELDS:
- emotion: neutral|happy|distress|high_distress|angry|confused|fear|urgency
- intent: short label like water_supply, road_complaint, electricity_issue, pension_query, police_complaint, health_emergency, corruption_report, legal_divorce, education_query, civic_inspection, general, off_topic
- intentConfidence: 0.0-1.0 (how clear the intent is)
- isSensitive: true for divorce/abuse/death/mental health/domestic violence
- isUrgent: true ONLY for real emergencies (accident, fire, immediate physical danger). NOT for general angry/frustrated callers.
- dialect: standard, north_karnataka, south_karnataka, coastal_karnataka, bangalore_urban, hyderabad_karnataka (for Kannada). For Tamil: standard, madurai, chennai_colloquial. For Hindi: standard, deccani
- dialectNotes: brief note on colloquial expressions used (empty if standard)
- restatement: 1-sentence restatement of caller's issue in ${langName}. Empty if too vague.
- response: Your helpful reply in ${langName} ONLY. Max 2 sentences.

VERIFIED DEPARTMENT DIRECTORY (USE ONLY THESE NUMBERS):
${kbContext}

RESPONSE RULES:
- Respond ONLY in ${langName}. Never mix languages.
- Be professional, empathetic. Adjust tone to emotion.
- Understand colloquial/informal speech (Tamil: ஏதாச்சு=ஏதாவது, பத்தி=பற்றி, சொல்லுங்க=சொல்லுங்கள்).
- OFF-TOPIC: If caller asks about movies/entertainment/gossip, set intent="off_topic", redirect politely.
- GIVE REAL INFORMATION. Use ONLY the verified department numbers listed above.
- NEVER invent, fabricate, or guess phone numbers, addresses, or URLs. If you don't have a number, say "please call 1092 again during working hours".
- Each response MUST be DIFFERENT from the previous one. Do NOT repeat the same information.
${lastAiResponse ? `- YOUR LAST RESPONSE WAS: "${lastAiResponse.slice(0, 100)}". DO NOT repeat this. Say something NEW and DIFFERENT.` : ''}

MISUNDERSTANDING DETECTION (CRITICAL):
- If the caller says anything like "that's not what I asked", "you're not understanding", "wrong", "I didn't say that", "no no", "வேற சொல்றேன்", "நான் கேட்டது ஒன்னு", "அது இல்ல", "ಅದಲ್ಲ", "ये नहीं":
  → You MISUNDERSTOOD them. DO NOT continue with your previous assumption.
  → Set intent to "general" with low intentConfidence (0.2).
  → APOLOGIZE and ask them to clearly repeat what they need.
  → Example response: "மன்னிக்கவும், நான் தவறாக புரிந்துகொண்டேன். நீங்கள் என்ன உதவி தேவை என்று மீண்டும் சொல்ல முடியுமா?"
- If the caller corrects you (e.g., "I said civics, not treatment"), IMMEDIATELY adopt their correction.

ASR WARNING: The text you receive is from speech recognition and may contain errors. Consider alternative interpretations (e.g., "சிகிச்சை" might actually be "சிவிக்ஸ்", similar-sounding words may be transcribed wrong).

CONTEXT: stage=${stage}, prevIntent=${previousIntent}, prevEmotion=${previousEmotion}, entities=${entitiesJson}, turn=${memory.turnCount}
${memorySummary ? `MEMORY: ${memorySummary}` : ''}${memoryFacts !== 'none' ? ` FACTS: ${memoryFacts}` : ''}

STAGE: ${stage === 'confirmation' ? 'User was asked to confirm. Detect yes/no.' : stage === 'clarification' ? 'Ask ONE clarifying question.' : stage === 'solution' ? 'Give helpful suggestion + one follow-up.' : 'Understand intent, respond helpfully with REAL information.'}

Return ONLY the JSON object.`;

    // Append current user message to conversation history
    if (callSid) {
      sessionStore.appendToSession(callSid, { role: 'user', content: userText });
    }

    // Keep last 4 messages (2 turns) to save tokens
    const history = callSid ? sessionStore.getSession(callSid) : [{ role: 'user', content: userText }];
    const cleanHistory = history.slice(-4);

    // ── CALL LLM WITH AUTOMATIC PROVIDER FALLBACK ──
    const { content, provider: usedProvider, model: usedModel } = await callLLMWithFallback(
      [{ role: 'system', content: systemPrompt }, ...cleanHistory],
      512
    );

    logger.info('LLM response received', { usedProvider, usedModel, contentLength: content.length });

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      // Try extracting JSON using bracket-counting (handles nested {} correctly)
      parsed = extractJsonObject(content);
      if (!parsed) {
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
    if (result.response.length > 250) {
      result.response = result.response.slice(0, 250);
    }

    // ── HALLUCINATION GUARD: Strip any fake phone numbers ──
    result.response = stripHallucinatedPhoneNumbers(result.response);

    // ── Append verified department info if intent maps to a known department ──
    if (result.intent && result.intent !== 'general' && result.intent !== 'off_topic') {
      const deptContext = knowledgeBase.getDepartmentContext(result.intent, languageCode);
      if (deptContext && !result.response.includes(deptContext.split(',')[0]?.trim()?.slice(0, 20))) {
        // Only append if the response doesn't already contain the dept info
        const combined = result.response + ' ' + deptContext;
        result.response = combined.length > 350 ? combined.slice(0, 350) : combined;
      }
    }

    // ── ANTI-REPETITION GUARD ──
    // If the response is too similar to the last one, flag it
    if (lastAiResponse && result.response) {
      const similarity = getTextSimilarity(lastAiResponse, result.response);
      if (similarity > 0.7) {
        logger.warn('Response too similar to previous, requesting rephrase', { similarity });
        // Try to get a different response by adding a stronger anti-repeat instruction
        try {
          const retryMessages = [
            { role: 'system', content: systemPrompt + `\n\nCRITICAL: Your previous response was "${lastAiResponse.slice(0, 100)}". You MUST say something COMPLETELY DIFFERENT this time. Give new information, a new angle, or a specific action step.` },
            ...cleanHistory
          ];
          const retry = await callLLMWithFallback(retryMessages, 512);
          let retryParsed;
          const retryContent = retry.content;
          const retryJsonMatch = retryContent.match(/\{[\s\S]*\}/);
          if (retryJsonMatch) {
            retryParsed = JSON.parse(retryJsonMatch[0]);
            if (retryParsed.response && typeof retryParsed.response === 'string') {
              result.response = retryParsed.response.trim().slice(0, 250);
            }
          }
        } catch (retryErr) {
          // Keep original response if retry fails
          logger.warn('Anti-repetition retry failed', { error: retryErr?.message });
        }
      }
    }

    // Store dialect and urgency in session
    if (callSid) {
      sessionStore.updateSessionState(callSid, {
        dialect: result.dialect,
        dialectNotes: result.dialectNotes,
        isUrgent: result.isUrgent
      });
    }

    // Append AI response to context + store for anti-repetition
    if (callSid && result.response) {
      sessionStore.appendToSession(callSid, { role: 'assistant', content: result.response });
      sessionStore.updateSessionState(callSid, { lastAiResponse: result.response });
    }

    logger.info('Hybrid AI analysis complete', {
      callSid, languageCode, usedProvider, usedModel,
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
