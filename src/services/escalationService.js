// src/services/escalationService.js
// Centralized human escalation logic with multi-trigger detection,
// localized warm handoff messages, and structured context transfer.

const config = require('../config');
const logger = require('../utils/logger');
const sessionStore = require('../utils/sessionStore');

// ──────────────────────────────────────────────────────────────
// ESCALATION TRIGGERS
// ──────────────────────────────────────────────────────────────

// Multilingual keywords for "talk to a human"
const humanRequestPatterns = [
  // English
  /\b(human|person|agent|operator|real person|talk to someone|speak to someone|representative|connect me|transfer)\b/i,
  // Hindi
  /(इंसान|व्यक्ति|एजेंट|किसी से बात|कोई व्यक्ति|इंसानी सहायता|अधिकारी से बात|ऑपरेटर)/,
  // Tamil
  /(மனிதன்|நபர்|நபரிடம்|ஏஜெண்ட்|யாரிடமாவது பேச|ஒருவரிடம் பேச|நபரிடம் பேச|ஆள்|உதவியாளர்|அதிகாரி)/,
  // Kannada
  /(ಮನುಷ್ಯ|ವ್ಯಕ್ತಿ|ಏಜೆಂಟ್|ಯಾರಾದರೂ|ಒಬ್ಬ ವ್ಯಕ್ತಿ|ಅಧಿಕಾರಿ|ಯಾರನ್ನಾದರೂ ಸಂಪರ್ಕಿಸಿ|ಸಹಾಯಕ|ಆಪರೇಟರ್)/
];

/**
 * Checks if the user's speech explicitly requests a human agent.
 */
function isHumanRequested(speechText) {
  if (!speechText) return false;
  return humanRequestPatterns.some(pattern => pattern.test(speechText));
}

/**
 * Evaluates whether the current call should be escalated.
 * Returns { escalate: boolean, reason: string }
 */
function shouldEscalate(session, aiResult, speechText) {
  const confusionThreshold = config.escalationConfusionThreshold || 4;
  const clarificationThreshold = config.escalationClarificationThreshold || 3;

  // 1. User directly asks for a human
  if (isHumanRequested(speechText)) {
    return { escalate: true, reason: 'User requested human agent' };
  }

  // 2. Severe emotional distress
  if (aiResult?.emotion === 'high_distress') {
    return { escalate: true, reason: 'User in severe distress' };
  }

  // 3. Fear detected — potential danger situation
  if (aiResult?.emotion === 'fear') {
    return { escalate: true, reason: 'User expressing fear — possible danger' };
  }

  // 4. Urgency detected — time-sensitive situation
  if (aiResult?.isUrgent || aiResult?.emotion === 'urgency') {
    return { escalate: true, reason: 'Urgent/emergency situation detected' };
  }

  // 5. Too many confusion rounds
  if (session.confusionCount >= confusionThreshold) {
    return { escalate: true, reason: `Repeated confusion (${session.confusionCount} rounds)` };
  }

  // 6. Sensitive topic + too many clarification turns
  if (aiResult?.isSensitive && session.clarificationTurns >= clarificationThreshold) {
    return { escalate: true, reason: 'Sensitive topic needs human handling' };
  }

  // 7. Consistently very low intent confidence (3+ consecutive)
  if (aiResult?.intentConfidence < 0.2 && session.confusionCount >= 3) {
    return { escalate: true, reason: 'AI cannot understand user intent' };
  }

  return { escalate: false, reason: null };
}

// ──────────────────────────────────────────────────────────────
// LOCALIZED MESSAGES
// ──────────────────────────────────────────────────────────────

const handoffMessages = {
  'kn-IN': 'ನಾನು ನಿಮ್ಮನ್ನು ಉತ್ತಮವಾಗಿ ಸಹಾಯ ಮಾಡಬಲ್ಲ ಅಧಿಕಾರಿಗೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ.',
  'en-IN': 'Let me connect you to an officer who can help better. Please hold.',
  'hi-IN': 'मैं आपको एक अधिकारी से जोड़ रहा हूँ जो बेहतर मदद कर सकें। कृपया प्रतीक्षा करें।',
  'ta-IN': 'நான் உங்களை ஒரு அதிகாரியிடம் இணைக்கிறேன், அவர் நன்கு உதவ முடியும். தயவுசெய்து காத்திருங்கள்.'
};

const transferFailedMessages = {
  'kn-IN': 'ಕ್ಷಮಿಸಿ, ಈಗ ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಕರೆ ಮಾಡಿ.',
  'en-IN': "I'm sorry, I could not connect you right now. Please try calling again shortly.",
  'hi-IN': 'माफ़ कीजिए, मैं अभी आपको जोड़ नहीं पा रहा हूँ। कृपया कुछ देर बाद फिर कॉल करें।',
  'ta-IN': 'மன்னிக்கவும், இப்போது உங்களை இணைக்க இயலவில்லை. சிறிது நேரம் கழித்து மீண்டும் அழைக்கவும்.'
};

function getHandoffMessage(languageCode) {
  return handoffMessages[languageCode] || handoffMessages['en-IN'];
}

function getTransferFailedMessage(languageCode) {
  return transferFailedMessages[languageCode] || transferFailedMessages['en-IN'];
}

// ──────────────────────────────────────────────────────────────
// ESCALATION CONTEXT
// ──────────────────────────────────────────────────────────────

/**
 * Builds a structured summary for the human agent receiving the call.
 */
function buildEscalationSummary(callSid, languageCode, reason) {
  const callData = sessionStore.getCallSummary(callSid);

  const summary = {
    callSid,
    language: languageCode,
    topic: callData.topic,
    emotion: callData.emotion,
    dialect: callData.dialect || 'standard',
    isUrgent: callData.isUrgent || false,
    conversationSummary: callData.summary,
    facts: callData.facts,
    turnCount: callData.turnCount,
    confusionCount: callData.confusionCount,
    escalationReason: reason,
    callDurationMs: callData.callDuration,
    timestamp: new Date().toISOString()
  };

  logger.info('Escalation summary generated', summary);
  return summary;
}

module.exports = {
  shouldEscalate,
  isHumanRequested,
  getHandoffMessage,
  getTransferFailedMessage,
  buildEscalationSummary
};
