// src/utils/sessionStore.js
// Hybrid session store: in-memory (fast reads) + Redis (persistence).
// Sessions auto-expire after 30 minutes via Redis TTL + in-memory cleanup.

const redisClient = require('./redisClient');
const logger = require('./logger');

const sessions = {};
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let cleanupTimer = null;

// Database service reference (set lazily to avoid circular deps)
let _db = null;
function getDb() {
  if (!_db) _db = require('../services/databaseService');
  return _db;
}

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
    silenceCount: 0,
    consecutiveNeutral: 0,
    emotion: null,
    // Dialect detection
    dialect: 'standard',
    dialectNotes: '',
    // Urgency flag
    isUrgent: false,
    // Restatement from AI (for verification step)
    lastRestatement: '',
    // Last AI response (for anti-repetition)
    lastAiResponse: '',
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

  // Persist to Redis asynchronously (non-blocking)
  redisClient.setSession(callSid, sessions[callSid]).catch(() => {});
}

function incrementConfusion(callSid) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.confusionCount += 1;
  redisClient.setSession(callSid, session).catch(() => {});
}

function resetConfusion(callSid) {
  if (!callSid) return;
  const session = getSessionState(callSid);
  session.confusionCount = 0;
  redisClient.setSession(callSid, session).catch(() => {});
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

  // Persist to Redis asynchronously
  redisClient.setSession(callSid, session).catch(() => {});
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
  redisClient.setSession(callSid, session).catch(() => {});
}

// Ensure compatibility for existing code calls
function getSession(callSid) {
  const state = getSessionState(callSid);
  return state.messages;
}

function clearSession(callSid) {
  if (callSid && sessions[callSid]) {
    delete sessions[callSid];
    // Remove from Redis too
    redisClient.deleteSession(callSid).catch(() => {});
  }
}

/**
 * Returns a snapshot of all active sessions count.
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

// ──────────────────────────────────────────────────────────────
// SESSION TTL CLEANUP — Prevents memory leaks from orphaned sessions
// ──────────────────────────────────────────────────────────────

function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;
  const db = getDb();

  for (const [callSid, session] of Object.entries(sessions)) {
    const age = now - (session.callStartedAt || now);
    if (age > SESSION_TTL_MS) {
      // Persist final summary to DB before cleanup
      db.upsertCallSummary(callSid, {
        primaryIntent: session.intent || session.pendingIntent || null,
        primaryEmotion: session.emotion || null,
        dialect: session.dialect || null,
        isUrgent: session.isUrgent || false,
        turns: session.turnCount || 0,
        durationMs: age,
        conversationSummary: session.summary || null,
        facts: session.facts || null,
        endedAt: new Date()
      }).catch(() => {});

      delete sessions[callSid];
      redisClient.deleteSession(callSid).catch(() => {});
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Session TTL cleanup', { cleaned, remaining: Object.keys(sessions).length });
  }
}

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
  // Don't prevent process from exiting
  if (cleanupTimer.unref) cleanupTimer.unref();
  logger.info('Session cleanup timer started', { intervalMs: CLEANUP_INTERVAL_MS, ttlMs: SESSION_TTL_MS });
}

// ──────────────────────────────────────────────────────────────
// REDIS RESTORE — Load active sessions from Redis on startup
// ──────────────────────────────────────────────────────────────

async function restoreFromRedis() {
  try {
    const stored = await redisClient.getAllSessions();
    if (stored.length === 0) {
      logger.info('Redis restore: no sessions to restore');
      return 0;
    }

    let restored = 0;
    for (const { callSid, session } of stored) {
      // Only restore sessions that aren't too old
      const age = Date.now() - (session.callStartedAt || Date.now());
      if (age < SESSION_TTL_MS) {
        sessions[callSid] = session;
        restored++;
      }
    }

    logger.info('Redis restore complete', { restored, skipped: stored.length - restored });
    return restored;
  } catch (err) {
    logger.error('Redis restore failed', { error: err.message });
    return 0;
  }
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
  getCallSummary,
  startCleanupTimer,
  restoreFromRedis,
  cleanupExpiredSessions
};
