const sessions = {};

function createDefaultSession() {
  return {
    // Short-term memory: raw messages (last 6)
    messages: [],
    // Long-term memory: compressed summary of older messages
    summary: '',
    // Structured facts extracted from conversation
    facts: {
      topic: null,
      preferences: null,
      language: null,
      lastEmotion: null,
      isSensitive: false,
      confirmed: false,
      decisions: []
    },
    // State machine
    stage: 'intent_detection', // 'intent_detection', 'confirmation', 'clarification', 'solution'
    intent: null,
    pendingIntent: null,
    entities: {
      topic: null,
      preference: null
    },
    // Counters
    confusionCount: 0,
    clarificationTurns: 0,
    turnCount: 0,         // total turns in this call
    emotion: null,
    // Dialect detection
    dialect: 'standard',
    dialectNotes: '',
    // Urgency flag
    isUrgent: false,
    // Restatement from AI (for verification step)
    lastRestatement: '',
    // Feedback tracking
    feedbackHistory: [],
    // Timestamps
    callStartedAt: Date.now()
  };
}

function getSessionState(callSid) {
  if (!callSid) return createDefaultSession();
  if (!sessions[callSid]) {
    sessions[callSid] = createDefaultSession();
  }
  return sessions[callSid];
}

function updateSessionState(callSid, updates) {
  if (!callSid) return;
  if (!sessions[callSid]) {
    sessions[callSid] = createDefaultSession();
  }
  Object.assign(sessions[callSid], updates);
}

function incrementConfusion(callSid) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.confusionCount += 1;
}

function resetConfusion(callSid) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.confusionCount = 0;
}

function appendToSession(callSid, message) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.messages.push(message);
  session.turnCount += 1;

  // Keep only the last 6 raw messages (short-term memory)
  // Older messages are compressed into session.summary by summarizationService
  if (session.messages.length > 6) {
    session.messages = session.messages.slice(-6);
  }
}

/**
 * Records a feedback entry for this call session.
 */
function addFeedback(callSid, feedback) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.feedbackHistory.push({
    ...feedback,
    timestamp: new Date().toISOString()
  });
}

/**
 * Returns the full memory context for the AI prompt.
 * Combines: long-term summary + structured facts + recent raw messages
 */
function getSummaryContext(callSid) {
  const session = getSessionState(callSid);
  return {
    summary: session.summary || '',
    facts: session.facts || {},
    recentMessages: session.messages || [],
    turnCount: session.turnCount || 0
  };
}

/**
 * Checks if summarization should be triggered.
 * Returns the messages that need to be summarized (before truncation).
 */
function shouldSummarize(callSid) {
  const session = getSessionState(callSid);
  // Trigger summarization every 6 turns (and there are enough messages)
  return session.turnCount > 0 && session.turnCount % 6 === 0 && session.messages.length >= 4;
}

/**
 * Gets the current messages for summarization (before they get truncated).
 */
function getMessagesForSummarization(callSid) {
  const session = getSessionState(callSid);
  // Return the older half of messages to summarize
  if (session.messages.length <= 2) return [];
  return session.messages.slice(0, -2); // keep last 2, summarize the rest
}

/**
 * Updates the session with a new summary after summarization completes.
 */
function updateSummary(callSid, newSummary, newFacts) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.summary = newSummary;
  if (newFacts) {
    session.facts = { ...session.facts, ...newFacts };
  }
}

// Ensure compatibility for existing code calls
function getSession(callSid) {
  const state = getSessionState(callSid);
  return state.messages;
}

function clearSession(callSid) {
  if (callSid && sessions[callSid]) {
    delete sessions[callSid];
  }
}

/**
 * Returns a snapshot of all active sessions (for analytics).
 */
function getActiveSessions() {
  return Object.keys(sessions).length;
}

/**
 * Returns live state for all active sessions (for agent panel).
 */
function getAllActiveSessions() {
  const result = [];
  for (const [callSid, session] of Object.entries(sessions)) {
    result.push({
      callSid,
      language: session.facts?.language || 'unknown',
      stage: session.stage,
      intent: session.intent || session.pendingIntent || 'unknown',
      emotion: session.emotion || 'neutral',
      dialect: session.dialect || 'standard',
      dialectNotes: session.dialectNotes || '',
      isUrgent: session.isUrgent || false,
      turnCount: session.turnCount,
      confusionCount: session.confusionCount,
      lastRestatement: session.lastRestatement || '',
      summary: session.summary || '',
      facts: session.facts || {},
      callDuration: Date.now() - (session.callStartedAt || Date.now()),
      recentMessages: (session.messages || []).slice(-4) // last 2 exchanges
    });
  }
  return result;
}

/**
 * Returns session data for escalation summary.
 */
function getCallSummary(callSid) {
  const session = getSessionState(callSid);
  return {
    topic: session.facts?.topic || session.intent || 'unknown',
    emotion: session.emotion || 'neutral',
    dialect: session.dialect || 'standard',
    dialectNotes: session.dialectNotes || '',
    isUrgent: session.isUrgent || false,
    summary: session.summary || 'No conversation summary available.',
    facts: session.facts || {},
    turnCount: session.turnCount || 0,
    confusionCount: session.confusionCount || 0,
    stage: session.stage,
    callDuration: Date.now() - (session.callStartedAt || Date.now())
  };
}

module.exports = {
  getSessionState,
  updateSessionState,
  incrementConfusion,
  resetConfusion,
  getSession,
  appendToSession,
  addFeedback,
  clearSession,
  getSummaryContext,
  shouldSummarize,
  getMessagesForSummarization,
  updateSummary,
  getActiveSessions,
  getAllActiveSessions,
  getCallSummary
};
