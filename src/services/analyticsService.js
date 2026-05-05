// src/services/analyticsService.js
// In-memory metrics + PostgreSQL persistence for the AI call agent.
// Tracks call events, aggregates metrics, and provides queryable snapshots.

const logger = require('../utils/logger');
const db = require('./databaseService');

// ──────────────────────────────────────────────────────────────
// METRICS STORE (in-memory for fast reads, DB for persistence)
// ──────────────────────────────────────────────────────────────

const metrics = {
  totalCalls: 0,
  activeCalls: 0,
  completedCalls: 0,
  totalTurns: 0,
  languageDistribution: {},
  intentDistribution: {},
  emotionDistribution: {},
  dialectDistribution: {},
  confidenceBuckets: { low: 0, medium: 0, high: 0 },
  escalations: { total: 0, reasons: {} },
  urgentCalls: 0,
  feedback: { correct: 0, partially_correct: 0, incorrect: 0 },
  errors: { aiFailures: 0, webhookErrors: 0, qualityGuardTriggers: 0, asrTooLow: 0 },
  summarizations: { total: 0, failures: 0 },
  startedAt: new Date().toISOString()
};

const MAX_RECENT_CALLS = 50;
const recentCalls = [];
const callTracking = {};

// ──────────────────────────────────────────────────────────────
// EVENT TRACKING (in-memory + DB write)
// ──────────────────────────────────────────────────────────────

function trackEvent(eventType, data = {}) {
  const timestamp = new Date().toISOString();

  // Persist to PostgreSQL (non-blocking)
  db.insertEvent(data.callSid || null, eventType, data.languageCode || null, data)
    .catch(() => {});

  switch (eventType) {
    case 'call_started':
      metrics.totalCalls++;
      metrics.activeCalls++;
      callTracking[data.callSid] = {
        startedAt: Date.now(),
        language: null, turns: 0, intents: [], emotions: [],
        dialects: [], isUrgent: false,
        escalated: false, escalationReason: null, from: data.from
      };
      // Create call summary in DB
      db.upsertCallSummary(data.callSid, { from: data.from, startedAt: new Date() }).catch(() => {});
      break;

    case 'language_selected':
      if (data.languageCode) {
        metrics.languageDistribution[data.languageCode] = (metrics.languageDistribution[data.languageCode] || 0) + 1;
        if (callTracking[data.callSid]) callTracking[data.callSid].language = data.languageCode;
        db.upsertCallSummary(data.callSid, { languageCode: data.languageCode }).catch(() => {});
      }
      break;

    case 'speech_received':
      metrics.totalTurns++;
      if (callTracking[data.callSid]) callTracking[data.callSid].turns++;
      break;

    case 'intent_detected':
      if (data.intent) {
        metrics.intentDistribution[data.intent] = (metrics.intentDistribution[data.intent] || 0) + 1;
        if (callTracking[data.callSid]) callTracking[data.callSid].intents.push(data.intent);
      }
      break;

    case 'emotion_detected':
      if (data.emotion) {
        metrics.emotionDistribution[data.emotion] = (metrics.emotionDistribution[data.emotion] || 0) + 1;
        if (callTracking[data.callSid]) callTracking[data.callSid].emotions.push(data.emotion);
      }
      break;

    case 'dialect_detected':
      if (data.dialect) {
        metrics.dialectDistribution[data.dialect] = (metrics.dialectDistribution[data.dialect] || 0) + 1;
        if (callTracking[data.callSid]) callTracking[data.callSid].dialects.push(data.dialect);
        db.upsertCallSummary(data.callSid, { dialect: data.dialect, dialectNotes: data.dialectNotes }).catch(() => {});
      }
      break;

    case 'urgency_detected':
      metrics.urgentCalls++;
      if (callTracking[data.callSid]) callTracking[data.callSid].isUrgent = true;
      db.upsertCallSummary(data.callSid, { isUrgent: true }).catch(() => {});
      break;

    case 'confidence_low': metrics.confidenceBuckets.low++; break;
    case 'confidence_medium': metrics.confidenceBuckets.medium++; break;
    case 'confidence_high': metrics.confidenceBuckets.high++; break;
    case 'asr_too_low': metrics.errors.asrTooLow++; break;

    case 'escalation_triggered':
      metrics.escalations.total++;
      if (data.reason) metrics.escalations.reasons[data.reason] = (metrics.escalations.reasons[data.reason] || 0) + 1;
      if (callTracking[data.callSid]) {
        callTracking[data.callSid].escalated = true;
        callTracking[data.callSid].escalationReason = data.reason;
      }
      db.upsertCallSummary(data.callSid, { escalated: true, escalationReason: data.reason }).catch(() => {});
      break;

    case 'ai_failure': metrics.errors.aiFailures++; break;
    case 'webhook_error': metrics.errors.webhookErrors++; break;
    case 'quality_guard': metrics.errors.qualityGuardTriggers++; break;
    case 'summarization_done': metrics.summarizations.total++; break;
    case 'summarization_failed': metrics.summarizations.failures++; break;

    case 'call_ended':
      metrics.activeCalls = Math.max(0, metrics.activeCalls - 1);
      metrics.completedCalls++;

      if (callTracking[data.callSid]) {
        const cd = callTracking[data.callSid];
        const callSummary = {
          callSid: data.callSid, from: cd.from, language: cd.language,
          turns: cd.turns, duration: Date.now() - cd.startedAt,
          primaryIntent: getMostFrequent(cd.intents),
          primaryEmotion: getMostFrequent(cd.emotions),
          dialect: getMostFrequent(cd.dialects),
          isUrgent: cd.isUrgent,
          escalated: cd.escalated, endedAt: timestamp
        };

        recentCalls.push(callSummary);
        if (recentCalls.length > MAX_RECENT_CALLS) recentCalls.shift();

        // Persist final call summary
        db.upsertCallSummary(data.callSid, {
          primaryIntent: callSummary.primaryIntent,
          primaryEmotion: callSummary.primaryEmotion,
          dialect: callSummary.dialect,
          isUrgent: callSummary.isUrgent,
          turns: callSummary.turns,
          durationMs: callSummary.duration,
          endedAt: new Date(),
          conversationSummary: data.summary || null,
          facts: data.facts || null
        }).catch(() => {});

        delete callTracking[data.callSid];
      }
      break;
  }

  logger.info(`Analytics: ${eventType}`, { ...data, timestamp });
}

// ──────────────────────────────────────────────────────────────
// QUERY FUNCTIONS
// ──────────────────────────────────────────────────────────────

function getMetrics() {
  return {
    ...metrics,
    uptimeSeconds: Math.floor((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
    avgTurnsPerCall: metrics.completedCalls > 0
      ? Math.round(metrics.totalTurns / metrics.completedCalls * 10) / 10 : 0,
    escalationRate: metrics.completedCalls > 0
      ? Math.round(metrics.escalations.total / metrics.completedCalls * 1000) / 10 + '%' : '0%',
    queriedAt: new Date().toISOString()
  };
}

function getRecentCalls() {
  return { count: recentCalls.length, calls: [...recentCalls].reverse() };
}

function getMostFrequent(arr) {
  if (!arr || arr.length === 0) return null;
  const freq = {};
  let maxCount = 0, maxItem = arr[0];
  for (const item of arr) {
    freq[item] = (freq[item] || 0) + 1;
    if (freq[item] > maxCount) { maxCount = freq[item]; maxItem = item; }
  }
  return maxItem;
}

module.exports = { trackEvent, getMetrics, getRecentCalls };
