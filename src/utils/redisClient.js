// src/utils/redisClient.js
// Redis connection with auto-reconnect and graceful fallback to in-memory.

const Redis = require('ioredis');
const logger = require('./logger');

let client = null;
let isConnected = false;

const SESSION_PREFIX = 'session:';
const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

/**
 * Initialize Redis connection.
 * Returns the client (or null if unavailable).
 */
function initialize(redisUrl) {
  if (!redisUrl) {
    logger.warn('REDIS_URL not set — running without Redis persistence');
    return null;
  }

  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) {
          logger.error('Redis: max retries reached, giving up');
          return null; // stop retrying
        }
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
      lazyConnect: false,
      enableReadyCheck: true
    });

    client.on('connect', () => {
      isConnected = true;
      logger.info('Redis connected');
    });

    client.on('ready', () => {
      isConnected = true;
    });

    client.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    client.on('close', () => {
      isConnected = false;
      logger.warn('Redis connection closed');
    });

    client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    return client;
  } catch (err) {
    logger.error('Redis initialization failed', { error: err.message });
    return null;
  }
}

/**
 * Save a session to Redis with TTL.
 */
async function setSession(callSid, sessionData) {
  if (!client || !isConnected) return false;
  try {
    const key = SESSION_PREFIX + callSid;
    await client.set(key, JSON.stringify(sessionData), 'EX', SESSION_TTL_SECONDS);
    return true;
  } catch (err) {
    logger.error('Redis setSession failed', { error: err.message, callSid });
    return false;
  }
}

/**
 * Get a session from Redis.
 */
async function getSession(callSid) {
  if (!client || !isConnected) return null;
  try {
    const key = SESSION_PREFIX + callSid;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Redis getSession failed', { error: err.message, callSid });
    return null;
  }
}

/**
 * Delete a session from Redis.
 */
async function deleteSession(callSid) {
  if (!client || !isConnected) return false;
  try {
    const key = SESSION_PREFIX + callSid;
    await client.del(key);
    return true;
  } catch (err) {
    logger.error('Redis deleteSession failed', { error: err.message, callSid });
    return false;
  }
}

/**
 * Get all active session keys from Redis.
 * Returns array of { callSid, session } objects.
 */
async function getAllSessions() {
  if (!client || !isConnected) return [];
  try {
    const keys = await client.keys(SESSION_PREFIX + '*');
    if (keys.length === 0) return [];

    const pipeline = client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();

    const sessions = [];
    keys.forEach((key, index) => {
      const [err, data] = results[index];
      if (!err && data) {
        try {
          const callSid = key.replace(SESSION_PREFIX, '');
          sessions.push({ callSid, session: JSON.parse(data) });
        } catch { /* skip corrupt entries */ }
      }
    });

    return sessions;
  } catch (err) {
    logger.error('Redis getAllSessions failed', { error: err.message });
    return [];
  }
}

/**
 * Refresh TTL on a session (keep it alive during active use).
 */
async function refreshTTL(callSid) {
  if (!client || !isConnected) return false;
  try {
    const key = SESSION_PREFIX + callSid;
    await client.expire(key, SESSION_TTL_SECONDS);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Check if Redis is connected.
 */
function getStatus() {
  return {
    connected: isConnected,
    status: client ? client.status : 'not_initialized'
  };
}

/**
 * Gracefully close the Redis connection.
 */
async function close() {
  if (client) {
    try {
      await client.quit();
    } catch { /* ignore */ }
    client = null;
    isConnected = false;
  }
}

module.exports = {
  initialize,
  setSession,
  getSession,
  deleteSession,
  getAllSessions,
  refreshTTL,
  getStatus,
  close,
  SESSION_TTL_SECONDS
};
