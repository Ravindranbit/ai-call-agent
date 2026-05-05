// src/services/databaseService.js
// PostgreSQL connection pool + schema initialization + query helpers
// Stores call events, call summaries, feedback logs, and metrics persistently.

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

let pool = null;
let isReady = false;

// ──────────────────────────────────────────────────────────────
// CONNECTION
// ──────────────────────────────────────────────────────────────

function getPool() {
  if (!pool && config.databaseUrl) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
    });
  }
  return pool;
}

// ──────────────────────────────────────────────────────────────
// SCHEMA INITIALIZATION
// ──────────────────────────────────────────────────────────────

async function initialize() {
  const p = getPool();
  if (!p) {
    logger.warn('DATABASE_URL not set — running without persistence');
    return false;
  }

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS call_events (
        id SERIAL PRIMARY KEY,
        call_sid VARCHAR(64),
        event_type VARCHAR(50) NOT NULL,
        language_code VARCHAR(10),
        data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS call_summaries (
        id SERIAL PRIMARY KEY,
        call_sid VARCHAR(64) UNIQUE NOT NULL,
        from_number VARCHAR(30),
        language_code VARCHAR(10),
        primary_intent VARCHAR(100),
        primary_emotion VARCHAR(30),
        dialect VARCHAR(50),
        dialect_notes TEXT,
        is_urgent BOOLEAN DEFAULT FALSE,
        turns INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        escalated BOOLEAN DEFAULT FALSE,
        escalation_reason VARCHAR(200),
        conversation_summary TEXT,
        facts JSONB DEFAULT '{}',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ended_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS feedback_logs (
        id SERIAL PRIMARY KEY,
        call_sid VARCHAR(64),
        language_code VARCHAR(10),
        turn_number INTEGER DEFAULT 0,
        original_text TEXT,
        ai_interpretation TEXT,
        corrected_interpretation TEXT,
        confirmation_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        corrected_by VARCHAR(20) DEFAULT 'citizen',
        original_intent VARCHAR(100),
        corrected_intent VARCHAR(100),
        original_emotion VARCHAR(30),
        corrected_emotion VARCHAR(30),
        dialect VARCHAR(50),
        agent_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS metrics_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_events_call_sid ON call_events(call_sid);
      CREATE INDEX IF NOT EXISTS idx_events_type ON call_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_created ON call_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_summaries_started ON call_summaries(started_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_call_sid ON feedback_logs(call_sid);
      CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_logs(confirmation_status);
      CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_logs(created_at);
    `);

    // Add new columns to existing tables (safe with IF NOT EXISTS via DO blocks)
    await p.query(`
      DO $$ BEGIN
        ALTER TABLE call_summaries ADD COLUMN IF NOT EXISTS dialect VARCHAR(50);
      EXCEPTION WHEN others THEN NULL;
      END $$;
      DO $$ BEGIN
        ALTER TABLE call_summaries ADD COLUMN IF NOT EXISTS dialect_notes TEXT;
      EXCEPTION WHEN others THEN NULL;
      END $$;
      DO $$ BEGIN
        ALTER TABLE call_summaries ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    isReady = true;
    logger.info('PostgreSQL schema initialized');
    return true;
  } catch (err) {
    logger.error('PostgreSQL initialization failed', { error: err.message });
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// WRITE OPERATIONS
// ──────────────────────────────────────────────────────────────

async function insertEvent(callSid, eventType, languageCode, data) {
  if (!isReady) return;
  try {
    await getPool().query(
      `INSERT INTO call_events (call_sid, event_type, language_code, data)
       VALUES ($1, $2, $3, $4)`,
      [callSid, eventType, languageCode || null, JSON.stringify(data || {})]
    );
  } catch (err) {
    logger.error('Failed to insert event', { error: err.message, eventType });
  }
}

async function upsertCallSummary(callSid, data) {
  if (!isReady) return;
  try {
    await getPool().query(
      `INSERT INTO call_summaries (call_sid, from_number, language_code, primary_intent, primary_emotion,
         dialect, dialect_notes, is_urgent,
         turns, duration_ms, escalated, escalation_reason, conversation_summary, facts, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (call_sid) DO UPDATE SET
         language_code = COALESCE(EXCLUDED.language_code, call_summaries.language_code),
         primary_intent = COALESCE(EXCLUDED.primary_intent, call_summaries.primary_intent),
         primary_emotion = COALESCE(EXCLUDED.primary_emotion, call_summaries.primary_emotion),
         dialect = COALESCE(EXCLUDED.dialect, call_summaries.dialect),
         dialect_notes = COALESCE(EXCLUDED.dialect_notes, call_summaries.dialect_notes),
         is_urgent = EXCLUDED.is_urgent OR call_summaries.is_urgent,
         turns = GREATEST(EXCLUDED.turns, call_summaries.turns),
         duration_ms = GREATEST(EXCLUDED.duration_ms, call_summaries.duration_ms),
         escalated = EXCLUDED.escalated OR call_summaries.escalated,
         escalation_reason = COALESCE(EXCLUDED.escalation_reason, call_summaries.escalation_reason),
         conversation_summary = COALESCE(EXCLUDED.conversation_summary, call_summaries.conversation_summary),
         facts = COALESCE(EXCLUDED.facts, call_summaries.facts),
         ended_at = COALESCE(EXCLUDED.ended_at, call_summaries.ended_at)`,
      [
        callSid,
        data.from || null,
        data.languageCode || null,
        data.primaryIntent || null,
        data.primaryEmotion || null,
        data.dialect || null,
        data.dialectNotes || null,
        data.isUrgent || false,
        data.turns || 0,
        data.durationMs || 0,
        data.escalated || false,
        data.escalationReason || null,
        data.conversationSummary || null,
        JSON.stringify(data.facts || {}),
        data.startedAt || new Date(),
        data.endedAt || null
      ]
    );
  } catch (err) {
    logger.error('Failed to upsert call summary', { error: err.message, callSid });
  }
}

// ──────────────────────────────────────────────────────────────
// FEEDBACK LOGGING (Learning from Corrections)
// ──────────────────────────────────────────────────────────────

async function insertFeedback(feedbackData) {
  if (!isReady) return null;
  try {
    const { rows } = await getPool().query(
      `INSERT INTO feedback_logs (
        call_sid, language_code, turn_number,
        original_text, ai_interpretation, corrected_interpretation,
        confirmation_status, corrected_by,
        original_intent, corrected_intent,
        original_emotion, corrected_emotion,
        dialect, agent_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        feedbackData.callSid || null,
        feedbackData.languageCode || null,
        feedbackData.turnNumber || 0,
        feedbackData.originalText || null,
        feedbackData.aiInterpretation || null,
        feedbackData.correctedInterpretation || null,
        feedbackData.confirmationStatus || 'unknown',
        feedbackData.correctedBy || 'citizen',
        feedbackData.originalIntent || null,
        feedbackData.correctedIntent || null,
        feedbackData.originalEmotion || null,
        feedbackData.correctedEmotion || null,
        feedbackData.dialect || null,
        feedbackData.agentNotes || null
      ]
    );
    logger.info('Feedback logged', { id: rows[0]?.id, status: feedbackData.confirmationStatus });
    return rows[0];
  } catch (err) {
    logger.error('Failed to insert feedback', { error: err.message });
    return null;
  }
}

async function getFeedbackStats() {
  if (!isReady) return null;
  try {
    const [statusCounts, intentCorrections, dialectBreakdown, recent] = await Promise.all([
      getPool().query(`
        SELECT confirmation_status, COUNT(*) as count
        FROM feedback_logs
        GROUP BY confirmation_status ORDER BY count DESC
      `),
      getPool().query(`
        SELECT original_intent, corrected_intent, COUNT(*) as count
        FROM feedback_logs
        WHERE corrected_intent IS NOT NULL AND corrected_intent != original_intent
        GROUP BY original_intent, corrected_intent ORDER BY count DESC LIMIT 20
      `),
      getPool().query(`
        SELECT dialect, COUNT(*) as count
        FROM feedback_logs
        WHERE dialect IS NOT NULL AND dialect != 'standard'
        GROUP BY dialect ORDER BY count DESC
      `),
      getPool().query(`
        SELECT * FROM feedback_logs ORDER BY created_at DESC LIMIT 20
      `)
    ]);

    return {
      confirmationStatusCounts: statusCounts.rows,
      intentCorrections: intentCorrections.rows,
      dialectBreakdown: dialectBreakdown.rows,
      recentFeedback: recent.rows
    };
  } catch (err) {
    logger.error('Failed to get feedback stats', { error: err.message });
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// READ OPERATIONS (for dashboard)
// ──────────────────────────────────────────────────────────────

async function getRecentCalls(limit = 50) {
  if (!isReady) return [];
  try {
    const { rows } = await getPool().query(
      `SELECT * FROM call_summaries ORDER BY started_at DESC LIMIT $1`, [limit]
    );
    return rows;
  } catch (err) {
    logger.error('Failed to get recent calls', { error: err.message });
    return [];
  }
}

async function getCallEvents(callSid) {
  if (!isReady) return [];
  try {
    const { rows } = await getPool().query(
      `SELECT * FROM call_events WHERE call_sid = $1 ORDER BY created_at ASC`, [callSid]
    );
    return rows;
  } catch (err) {
    logger.error('Failed to get call events', { error: err.message });
    return [];
  }
}

async function getDashboardStats() {
  if (!isReady) return null;
  try {
    const [totals, langs, intents, emotions, escalations, hourly, dialects, urgency, feedback] = await Promise.all([
      getPool().query(`
        SELECT 
          COUNT(*) as total_calls,
          COALESCE(AVG(turns), 0) as avg_turns,
          COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
          COUNT(*) FILTER (WHERE escalated = true) as escalated_calls,
          COUNT(*) FILTER (WHERE ended_at IS NOT NULL) as completed_calls
        FROM call_summaries
      `),
      getPool().query(`
        SELECT language_code, COUNT(*) as count 
        FROM call_summaries WHERE language_code IS NOT NULL
        GROUP BY language_code ORDER BY count DESC
      `),
      getPool().query(`
        SELECT primary_intent, COUNT(*) as count 
        FROM call_summaries WHERE primary_intent IS NOT NULL
        GROUP BY primary_intent ORDER BY count DESC LIMIT 15
      `),
      getPool().query(`
        SELECT primary_emotion, COUNT(*) as count 
        FROM call_summaries WHERE primary_emotion IS NOT NULL
        GROUP BY primary_emotion ORDER BY count DESC
      `),
      getPool().query(`
        SELECT escalation_reason, COUNT(*) as count 
        FROM call_summaries WHERE escalated = true AND escalation_reason IS NOT NULL
        GROUP BY escalation_reason ORDER BY count DESC
      `),
      getPool().query(`
        SELECT 
          DATE_TRUNC('hour', started_at) as hour,
          COUNT(*) as calls
        FROM call_summaries 
        WHERE started_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour ORDER BY hour
      `),
      getPool().query(`
        SELECT dialect, COUNT(*) as count
        FROM call_summaries
        WHERE dialect IS NOT NULL AND dialect != 'standard'
        GROUP BY dialect ORDER BY count DESC
      `),
      getPool().query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_urgent = true) as urgent_calls,
          COUNT(*) FILTER (WHERE is_urgent = false OR is_urgent IS NULL) as normal_calls
        FROM call_summaries
      `),
      getPool().query(`
        SELECT confirmation_status, COUNT(*) as count
        FROM feedback_logs
        GROUP BY confirmation_status ORDER BY count DESC
      `)
    ]);

    return {
      totals: totals.rows[0],
      languageDistribution: langs.rows,
      intentDistribution: intents.rows,
      emotionDistribution: emotions.rows,
      escalationReasons: escalations.rows,
      hourlyActivity: hourly.rows,
      dialectDistribution: dialects.rows,
      urgencyStats: urgency.rows[0],
      feedbackStats: feedback.rows
    };
  } catch (err) {
    logger.error('Failed to get dashboard stats', { error: err.message });
    return null;
  }
}

async function getEventStats() {
  if (!isReady) return null;
  try {
    const { rows } = await getPool().query(`
      SELECT event_type, COUNT(*) as count
      FROM call_events
      GROUP BY event_type
      ORDER BY count DESC
    `);
    return rows;
  } catch (err) {
    logger.error('Failed to get event stats', { error: err.message });
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// LIVE CALL STATE (for Agent Panel)
// ──────────────────────────────────────────────────────────────

async function getActiveCalls() {
  if (!isReady) return [];
  try {
    const { rows } = await getPool().query(`
      SELECT * FROM call_summaries
      WHERE ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 20
    `);
    return rows;
  } catch (err) {
    logger.error('Failed to get active calls', { error: err.message });
    return [];
  }
}

module.exports = {
  initialize,
  insertEvent,
  upsertCallSummary,
  insertFeedback,
  getFeedbackStats,
  getRecentCalls,
  getCallEvents,
  getDashboardStats,
  getEventStats,
  getActiveCalls,
  isReady: () => isReady
};
