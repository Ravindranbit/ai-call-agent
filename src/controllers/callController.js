const logger = require('../utils/logger');
const languageService = require('../services/languageService');
const conversationService = require('../services/conversationService');
const aiService = require('../services/aiService');
const twilioService = require('../services/twilioService');
const config = require('../config');
const gatherStore = require('../utils/gatherStore');
const sessionStore = require('../utils/sessionStore');
const intentService = require('../services/intentService');
const { getIntentPrompt, getFallbackPrompt, getRepeatedFallbackPrompt, getAiQualityFallbackPrompt, getPartialConfirmationPrompt } = require('../services/languagePrompts');
const escalationService = require('../services/escalationService');
const analyticsService = require('../services/analyticsService');
const summarizationService = require('../services/summarizationService');
const db = require('../services/databaseService');

function buildTwiml(xmlBody) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;
}

function getLanguageCodeFromRequest(req) {
  return req.query.lang || req.body.lang || 'kn-IN';
}

function getPublicBaseUrl() {
  return (config.publicUrl || '').replace(/\/$/, '');
}

exports.incoming = (req, res) => {
  const from = req.body.From || req.query.From || 'unknown';
  const callSid = req.body.CallSid || 'unknown';
  logger.info('Incoming call', { from, timestamp: new Date().toISOString() });
  console.log('🔥 INCOMING CALL HIT');

  // 📊 Analytics: call started
  analyticsService.trackEvent('call_started', { callSid, from });

  const publicBaseUrl = getPublicBaseUrl();
  const fallbackBase = `${req.protocol}://${req.get('host')}`;
  const base = (publicBaseUrl || fallbackBase).replace(/\/$/, '');
  const gatherAction = `${base}/api/call/gather`;
  const incomingAction = `${base}/api/call/incoming`;

  const menuPrompts = languageService.getMenuPrompts();
  const menuSayTags = menuPrompts
    .map((m) => `    <Say language="${m.code}" voice="${m.voice}">${m.menuPrompt}</Say>`)
    .join('\n');

  const twiml = buildTwiml(
    `<Response>\n` +
    `  <Gather input="dtmf" numDigits="1" action="${gatherAction}" method="POST" timeout="10">\n` +
    `    <Say language="en-IN" voice="Google.en-IN-Standard-A">Welcome to the 1092 Karnataka Helpline.</Say>\n` +
    menuSayTags + `\n` +
    `  </Gather>\n` +
    `  <Say language="en-IN" voice="Google.en-IN-Standard-A">We did not receive any input. Let us try again.</Say>\n` +
    `  <Redirect method="POST">${incomingAction}</Redirect>\n` +
    `</Response>`
  );

  return res.type('text/xml').status(200).send(twiml);
};

exports.gather = (req, res) => {
  console.log('🔥 GATHER HIT');
  try { gatherStore.push(req.body); } catch (err) { /* ignore */ }

  const digit = (req.body.Digits || '').trim();
  const from = req.body.From || 'unknown';
  const callSid = req.body.CallSid || 'unknown';
  const language = languageService.getLanguage(digit);

  const publicBaseUrl = getPublicBaseUrl();
  const fallbackBase = `${req.protocol}://${req.get('host')}`;
  const base = (publicBaseUrl || fallbackBase).replace(/\/$/, '');

  if (!language) {
    logger.info('Invalid language digit', { digit, from });
    const twiml = buildTwiml(
      `<Response>\n` +
      `  <Say>Invalid selection. Please try again.</Say>\n` +
      `  <Redirect method="POST">${base}/api/call/incoming</Redirect>\n` +
      `</Response>`
    );
    return res.type('text/xml').status(200).send(twiml);
  }

  console.log(`🌐 LANGUAGE SELECTED: ${digit} → ${language.code}`);
  logger.info('Language selected', { digit, languageCode: language.code, from });

  // 📊 Analytics: language selected
  analyticsService.trackEvent('language_selected', { callSid, languageCode: language.code });

  // Store language in session facts
  sessionStore.updateSessionState(callSid, { facts: { language: language.code } });

  const conversationCopy = languageService.getConversationCopy(language.code);
  const converseAction = `${base}/api/call/converse?lang=${encodeURIComponent(language.code)}`;
  const voiceAttr = language.voice ? ` voice="${language.voice}"` : '';

  const twiml = buildTwiml(
    `<Response>\n` +
    `  <Say language="${language.ttsLang}"${voiceAttr}>${language.greeting}</Say>\n` +
    `  <Gather input="speech" language="${language.speechLang}" speechTimeout="auto" timeout="5" action="${converseAction}" method="POST" actionOnEmptyResult="true" speechModel="phone_call" enhanced="true" hints="${language.speechHints}" />\n` +
    `</Response>`
  );

  return res.type('text/xml').status(200).send(twiml);
};

exports.debugGathers = (req, res) => {
  try {
    const items = gatherStore.list();
    return res.json({ count: items.length, items });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read gather debug store' });
  }
};

// ──────────────────────────────────────────────────────────────
// ESCALATION HANDLER
// ──────────────────────────────────────────────────────────────

function handleEscalation(res, conversationCopy, callSid, languageCode, reason) {
  // Build escalation summary for the human agent
  const summary = escalationService.buildEscalationSummary(callSid, languageCode, reason);
  console.log('🚨 ESCALATION:', JSON.stringify(summary));

  // 📊 Analytics: escalation
  analyticsService.trackEvent('escalation_triggered', { callSid, reason, languageCode });

  const handoffMessage = escalationService.getHandoffMessage(languageCode);
  const voiceAttr = conversationCopy.voice ? ` voice="${conversationCopy.voice}"` : '';
  const statusCallbackUrl = `${getPublicBaseUrl()}/api/call/status`;

  // Warm handoff → dial human
  if (config.escalationPhoneNumber) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${conversationCopy.ttsLang}"${voiceAttr}>${handoffMessage}</Say>
  <Dial action="${statusCallbackUrl}" method="POST" timeout="30">
    ${config.escalationPhoneNumber}
  </Dial>
  <Say language="${conversationCopy.ttsLang}"${voiceAttr}>${escalationService.getTransferFailedMessage(languageCode)}</Say>
</Response>`;
    return res.type('text/xml').send(twiml);
  }

  // No escalation number configured — apologize
  const fallbackMessage = escalationService.getTransferFailedMessage(languageCode);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${conversationCopy.ttsLang}"${voiceAttr}>${fallbackMessage}</Say>
</Response>`;
  return res.type('text/xml').send(twiml);
}

// ══════════════════════════════════════════════════════════════
// HYBRID FLOW: Speech → GPT (emotion + intent + dialect + urgency + response) → Decision Engine
// ══════════════════════════════════════════════════════════════

exports.converse = async (req, res) => {
  try {
    const from = req.body.From || req.query.From || 'unknown';
    const languageCode = getLanguageCodeFromRequest(req);
    const conversationCopy = languageService.getConversationCopy(languageCode);
    const speechText = (req.body.SpeechResult || '').trim();
    const confidence = req.body.Confidence || '';
    const recognitionError = req.body.SpeechRecognitionError || req.body.SpeechError || req.body.ErrorCode || req.body.ErrorMessage || '';

    logger.info('Converse webhook received', { from, languageCode, timestamp: new Date().toISOString() });
    console.log(`🎙️ SPEECH RECEIVED: "${speechText}" (lang=${languageCode}, confidence=${confidence})`);

    const callSid = req.body.CallSid;
    const session = sessionStore.getSessionState(callSid);

    // 📊 Analytics: speech received
    analyticsService.trackEvent('speech_received', { callSid, languageCode });

    const publicBaseUrl = getPublicBaseUrl();
    const nextActionPath = `${publicBaseUrl}/api/call/converse?lang=${encodeURIComponent(conversationCopy.languageCode)}`;

    // ── STEP 1: Handle recognition errors early ──
    if (recognitionError) {
      sessionStore.incrementConfusion(callSid);
      analyticsService.trackEvent('webhook_error', { callSid, error: recognitionError });
      const xml = conversationService.buildFallbackResponse({
        ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
        voice: conversationCopy.voice, fallbackText: conversationCopy.fallback,
        actionPath: nextActionPath, speechHints: conversationCopy.speechHints
      });
      return res.type('text/xml').send(xml);
    }

    // ── STEP 2: ASR Confidence gate ──
    const asrConfidence = confidence ? parseFloat(confidence) : 0.8;

    if (asrConfidence < 0.3) {
      sessionStore.incrementConfusion(callSid);
      analyticsService.trackEvent('asr_too_low', { callSid, asrConfidence });
      const xml = conversationService.buildFallbackResponse({
        ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
        voice: conversationCopy.voice, fallbackText: getFallbackPrompt(languageCode),
        actionPath: nextActionPath, speechHints: conversationCopy.speechHints
      });
      return res.type('text/xml').send(xml);
    }

    // ── STEP 2.5: Check for immediate escalation (user asks for human) ──
    const preEscalation = escalationService.shouldEscalate(session, null, speechText);
    if (preEscalation.escalate) {
      return handleEscalation(res, conversationCopy, callSid, languageCode, preEscalation.reason);
    }

    // ── STEP 3: SINGLE GPT CALL → emotion + intent + dialect + urgency + restatement + response ──
    const aiResult = await aiService.analyzeAndRespond({
      userText: speechText,
      languageCode: conversationCopy.languageCode,
      callSid: callSid
    });

    const { emotion, intent: intentName, intentConfidence, isSensitive, isUrgent, dialect, dialectNotes, restatement, response: aiResponse } = aiResult;

    // 📊 Analytics: intent + emotion + dialect detected
    analyticsService.trackEvent('intent_detected', { callSid, intent: intentName, intentConfidence });
    analyticsService.trackEvent('emotion_detected', { callSid, emotion });
    if (dialect && dialect !== 'standard') {
      analyticsService.trackEvent('dialect_detected', { callSid, dialect, dialectNotes });
    }
    if (isUrgent) {
      analyticsService.trackEvent('urgency_detected', { callSid, isUrgent });
    }

    // Store emotion in session (with persistence smoothing)
    let smoothedEmotion = emotion;
    const prevEmotion = session?.emotion;
    if (prevEmotion === 'distress' && smoothedEmotion === 'neutral') {
      smoothedEmotion = 'distress';
    }
    if (prevEmotion === 'fear' && smoothedEmotion === 'neutral') {
      smoothedEmotion = 'fear';
    }
    sessionStore.updateSessionState(callSid, {
      emotion: smoothedEmotion,
      lastRestatement: restatement || ''
    });

    // ── STEP 3.5: Check for post-analysis escalation ──
    const postEscalation = escalationService.shouldEscalate(session, aiResult, speechText);
    if (postEscalation.escalate) {
      return handleEscalation(res, conversationCopy, callSid, languageCode, postEscalation.reason);
    }

    // ── STEP 4: Combined confidence ──
    const combinedConfidence = (asrConfidence * 0.6) + (intentConfidence * 0.4);

    console.log('📊 HYBRID ANALYSIS:', JSON.stringify({
      speech: speechText, asr: asrConfidence, emotion: smoothedEmotion,
      intent: intentName, intentConfidence, combined: combinedConfidence,
      isSensitive, isUrgent, dialect, stage: session.stage, lang: languageCode, callSid
    }));

    // ══════════════════════════════════════════════════════════
    // DECISION ENGINE
    // ══════════════════════════════════════════════════════════

    // 🔴 LOW CONFIDENCE → REPEAT
    if (combinedConfidence < 0.4) {
      sessionStore.incrementConfusion(callSid);
      analyticsService.trackEvent('confidence_low', { callSid, combinedConfidence });

      // Log feedback: incorrect understanding
      db.insertFeedback({
        callSid, languageCode, turnNumber: session.turnCount,
        originalText: speechText, aiInterpretation: aiResponse,
        confirmationStatus: 'incorrect', correctedBy: 'system',
        originalIntent: intentName, originalEmotion: emotion, dialect
      }).catch(() => {});

      if (sessionStore.getSessionState(callSid).confusionCount >= 3) {
        const xml = conversationService.buildFallbackResponse({
          ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
          voice: conversationCopy.voice, fallbackText: getRepeatedFallbackPrompt(languageCode),
          actionPath: nextActionPath, speechHints: conversationCopy.speechHints
        });
        return res.type('text/xml').send(xml);
      }

      const xml = conversationService.buildFallbackResponse({
        ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
        voice: conversationCopy.voice, fallbackText: getFallbackPrompt(languageCode),
        actionPath: nextActionPath, speechHints: conversationCopy.speechHints
      });
      return res.type('text/xml').send(xml);
    }

    // 🟡 MEDIUM CONFIDENCE → CONFIRM (with restatement)
    if (combinedConfidence < 0.7 && session.stage !== 'confirmation') {
      analyticsService.trackEvent('confidence_medium', { callSid, combinedConfidence });

      if (intentName === 'general' && asrConfidence > 0.8) {
        // Fall through to use AI response directly
      } else {
        sessionStore.updateSessionState(callSid, { stage: 'confirmation', pendingIntent: intentName });

        // Use RESTATEMENT if available, otherwise use intent prompt
        let confirmPrompt;
        if (restatement && restatement.length > 5) {
          // Restatement-based verification: "I understood that you are facing [X]. Is that correct?"
          confirmPrompt = (conversationCopy.restatementPrefix || '') + restatement + (conversationCopy.restatementSuffix || '');
        } else {
          confirmPrompt = getIntentPrompt(intentName, languageCode);
        }

        const xml = conversationService.buildFallbackResponse({
          ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
          voice: conversationCopy.voice, fallbackText: confirmPrompt,
          actionPath: nextActionPath, speechHints: conversationCopy.speechHints
        });
        return res.type('text/xml').send(xml);
      }
    }

    // 🟢 HIGH CONFIDENCE → PROCEED
    analyticsService.trackEvent('confidence_high', { callSid, combinedConfidence });
    sessionStore.resetConfusion(callSid);

    // Topic Drift Guard
    if (session.intent === 'legal_divorce' && intentName === 'entertainment') {
      const xml = conversationService.buildFallbackResponse({
        ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
        voice: conversationCopy.voice, fallbackText: conversationCopy.topicDriftMessage || conversationCopy.fallback,
        actionPath: nextActionPath, speechHints: conversationCopy.speechHints
      });
      return res.type('text/xml').send(xml);
    }

    // STATE MACHINE ROUTING
    if (session.stage === 'confirmation') {
      const normalizedInput = intentService.normalizeInput(speechText);
      const confirmation = intentService.detectConfirmation(normalizedInput);

      if (confirmation === 'yes') {
        // ✅ Correct understanding — log positive feedback
        db.insertFeedback({
          callSid, languageCode, turnNumber: session.turnCount,
          originalText: speechText, aiInterpretation: session.lastRestatement || aiResponse,
          confirmationStatus: 'correct', correctedBy: 'citizen',
          originalIntent: session.pendingIntent, originalEmotion: emotion, dialect
        }).catch(() => {});

        if (session.pendingIntent === 'escalation') {
          return handleEscalation(res, conversationCopy, callSid, languageCode, 'User confirmed escalation');
        }
        sessionStore.updateSessionState(callSid, {
          stage: 'clarification', intent: session.pendingIntent,
          pendingIntent: null, clarificationTurns: 0
        });
        // Update facts on confirmation
        sessionStore.updateSessionState(callSid, {
          facts: { ...session.facts, confirmed: true, topic: session.pendingIntent }
        });

      } else if (confirmation === 'partial') {
        // 🟡 Partially correct — log partial feedback + ask for clarification
        db.insertFeedback({
          callSid, languageCode, turnNumber: session.turnCount,
          originalText: speechText, aiInterpretation: session.lastRestatement || aiResponse,
          confirmationStatus: 'partially_correct', correctedBy: 'citizen',
          originalIntent: session.pendingIntent, originalEmotion: emotion, dialect
        }).catch(() => {});

        sessionStore.updateSessionState(callSid, { stage: 'clarification', clarificationTurns: 0 });
        const partialPrompt = getPartialConfirmationPrompt(languageCode);
        const xml = conversationService.buildFallbackResponse({
          ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
          voice: conversationCopy.voice, fallbackText: partialPrompt,
          actionPath: nextActionPath, speechHints: conversationCopy.speechHints
        });
        return res.type('text/xml').send(xml);

      } else if (confirmation === 'no') {
        // ❌ Incorrect understanding — log negative feedback
        db.insertFeedback({
          callSid, languageCode, turnNumber: session.turnCount,
          originalText: speechText, aiInterpretation: session.lastRestatement || aiResponse,
          confirmationStatus: 'incorrect', correctedBy: 'citizen',
          originalIntent: session.pendingIntent, originalEmotion: emotion, dialect
        }).catch(() => {});

        sessionStore.updateSessionState(callSid, { stage: 'intent_detection', pendingIntent: null });
        const xml = conversationService.buildFallbackResponse({
          ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
          voice: conversationCopy.voice, fallbackText: conversationCopy.clarificationPrompt || conversationCopy.prompt,
          actionPath: nextActionPath, speechHints: conversationCopy.speechHints
        });
        return res.type('text/xml').send(xml);
      } else {
        // UNCLEAR response during confirmation
        // If user said something substantial (not just gibberish), treat it as new input
        if (speechText.length > 15 && intentName !== 'general') {
          // User is saying something new — exit confirmation and process as new intent
          sessionStore.updateSessionState(callSid, { stage: 'intent_detection', pendingIntent: null });
          sessionStore.resetConfusion(callSid);
          // Fall through to intent_detection handling below
        } else {
          sessionStore.incrementConfusion(callSid);
          const s = sessionStore.getSessionState(callSid);
          
          // After 3 unclear attempts, escape the loop — go back to intent detection
          if (s.confusionCount >= 3) {
            sessionStore.updateSessionState(callSid, { stage: 'intent_detection', pendingIntent: null });
            sessionStore.resetConfusion(callSid);
            const xml = conversationService.buildFallbackResponse({
              ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
              voice: conversationCopy.voice, 
              fallbackText: conversationCopy.clarificationPrompt || conversationCopy.prompt,
              actionPath: nextActionPath, speechHints: conversationCopy.speechHints
            });
            return res.type('text/xml').send(xml);
          }
          
          const fallbackText = s.confusionCount >= 2
            ? (conversationCopy.yesNoPrompt || conversationCopy.fallback)
            : (conversationCopy.unclearYesNoPrompt || conversationCopy.fallback);
          const xml = conversationService.buildFallbackResponse({
            ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
            voice: conversationCopy.voice, fallbackText,
            actionPath: nextActionPath, speechHints: conversationCopy.speechHints
          });
          return res.type('text/xml').send(xml);
        }
      }
    } else if (session.stage === 'intent_detection') {
      if (intentName !== 'general') {
        if (isSensitive) {
          sessionStore.updateSessionState(callSid, {
            stage: 'confirmation', pendingIntent: intentName,
            entities: { topic: intentName }
          });

          // Use restatement if available for sensitive topics
          let confirmText;
          if (restatement && restatement.length > 5) {
            confirmText = (conversationCopy.restatementPrefix || '') + restatement + (conversationCopy.restatementSuffix || '');
          } else {
            confirmText = conversationCopy.divorceConfirmation || getIntentPrompt(intentName, languageCode);
          }

          const xml = conversationService.buildFallbackResponse({
            ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
            voice: conversationCopy.voice, fallbackText: confirmText,
            actionPath: nextActionPath, speechHints: conversationCopy.speechHints
          });
          return res.type('text/xml').send(xml);
        } else {
          sessionStore.updateSessionState(callSid, {
            intent: intentName, entities: { topic: intentName }
          });
        }
      }
    } else if (session.stage === 'clarification') {
      sessionStore.updateSessionState(callSid, { clarificationTurns: session.clarificationTurns + 1 });

      if (session.clarificationTurns >= 2 && isSensitive) {
        sessionStore.updateSessionState(callSid, { stage: 'confirmation', pendingIntent: 'escalation' });
        const xml = conversationService.buildFallbackResponse({
          ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
          voice: conversationCopy.voice, fallbackText: conversationCopy.humanTransferPrompt || conversationCopy.fallback,
          actionPath: nextActionPath, speechHints: conversationCopy.speechHints
        });
        return res.type('text/xml').send(xml);
      }
    }

    // ── STEP 5: Use AI response ──
    let reply = aiResponse || '';

    // 🧠 AI QUALITY GUARD
    if (!reply || reply.length < 5 || /^(.)\1+$/.test(reply) || /^(okay|சரி|ஹம்|ಸರಿ|ठीक)$/i.test(reply)) {
      sessionStore.incrementConfusion(callSid);
      analyticsService.trackEvent('quality_guard', { callSid, reply: reply?.slice(0, 50) });
      const xml = conversationService.buildFallbackResponse({
        ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
        voice: conversationCopy.voice, fallbackText: getAiQualityFallbackPrompt(languageCode),
        actionPath: nextActionPath, speechHints: conversationCopy.speechHints
      });
      return res.type('text/xml').send(xml);
    }

    // ── STEP 6: Memory — trigger summarization if needed ──
    if (sessionStore.shouldSummarize(callSid)) {
      const messagesToSummarize = sessionStore.getMessagesForSummarization(callSid);
      if (messagesToSummarize.length > 0) {
        // Non-blocking summarization (don't delay the response)
        const currentSession = sessionStore.getSessionState(callSid);
        summarizationService.summarizeMessages(
          messagesToSummarize,
          currentSession.summary,
          languageCode
        ).then(newSummary => {
          const newFacts = summarizationService.extractFacts(messagesToSummarize, currentSession.facts, aiResult);
          sessionStore.updateSummary(callSid, newSummary, newFacts);
          analyticsService.trackEvent('summarization_done', { callSid, summaryLength: newSummary.length });
          console.log(`🧠 MEMORY SUMMARIZED: "${newSummary.slice(0, 100)}..."`);
        }).catch(err => {
          analyticsService.trackEvent('summarization_failed', { callSid, error: err?.message });
          logger.error('Background summarization failed', { error: err?.message });
        });
      }
    }

    // Also extract facts from the current AI result
    const currentSession = sessionStore.getSessionState(callSid);
    const updatedFacts = summarizationService.extractFacts([], currentSession.facts, aiResult);
    sessionStore.updateSessionState(callSid, { facts: updatedFacts });

    console.log(`🤖 AI RESPONSE: "${reply}" (lang=${languageCode}, emotion=${smoothedEmotion}, intent=${intentName}, dialect=${dialect})`);
    const xml = conversationService.buildConversationLoopResponse({
      ttsLang: conversationCopy.ttsLang, speechLang: conversationCopy.speechLang,
      voice: conversationCopy.voice, messageText: reply,
      actionPath: nextActionPath, speechHints: conversationCopy.speechHints
    });
    return res.type('text/xml').send(xml);

  } catch (err) {
    logger.error('Unhandled error in /api/call/converse', { error: err?.message || String(err) });
    analyticsService.trackEvent('webhook_error', { error: err?.message });
    const fallback = buildTwiml(
      `<Response>\n  <Say>Sorry, something went wrong. Please try again.</Say>\n` +
      `  <Redirect method="POST">${getPublicBaseUrl()}/api/call/incoming</Redirect>\n</Response>`
    );
    return res.type('text/xml').send(fallback);
  }
};

// ──────────────────────────────────────────────────────────────
// REMAINING EXPORTS
// ──────────────────────────────────────────────────────────────

exports.status = (req, res) => {
  const callSid = req.body.CallSid || req.query.CallSid;
  if (callSid) {
    logger.info('Call ended. Clearing session.', { callSid });
    analyticsService.trackEvent('call_ended', { callSid });
    sessionStore.clearSession(callSid);
  }
  return res.status(200).send('OK');
};

async function handleMakeCall(req, res) {
  try {
    // Accept phone number from query param (?to=+91...) or body
    const toNumber = req.query.to || req.body.to || null;
    const call = await twilioService.makeOutboundCall(toNumber);
    return res.status(200).json({ success: true, message: 'Call initiated', callSid: call.sid, to: call.to });
  } catch (error) {
    logger.error('Failed to initiate outbound call', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to initiate call', error: error.message });
  }
}

exports.makeCall = handleMakeCall;

// Call ALL verified numbers at once
async function handleMakeCallAll(req, res) {
  try {
    const numbers = ['+917845310959', '+918940388777', '+916379873249'];
    const results = await twilioService.makeMultipleCalls(numbers);
    return res.status(200).json({ success: true, message: `Called ${numbers.length} numbers`, results });
  } catch (error) {
    logger.error('Failed to initiate multi-call', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed', error: error.message });
  }
}

exports.makeCallAll = handleMakeCallAll;

// 📊 Analytics endpoints
exports.getAnalytics = (req, res) => {
  return res.json(analyticsService.getMetrics());
};

exports.getRecentCalls = (req, res) => {
  return res.json(analyticsService.getRecentCalls());
};
