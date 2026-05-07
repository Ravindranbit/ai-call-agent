const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const redisClient = require('./utils/redisClient');
const sessionStore = require('./utils/sessionStore');

const server = http.createServer(app);

// Initialize Redis connection
if (config.redisUrl) {
  redisClient.initialize(config.redisUrl);
}

server.listen(config.port, async () => {
  logger.info(`Server listening on port ${config.port}`);

  // Restore sessions from Redis after server starts
  const restored = await sessionStore.restoreFromRedis();
  if (restored > 0) {
    logger.info(`Restored ${restored} active sessions from Redis`);
  }

  // Start session TTL cleanup timer
  sessionStore.startCleanupTimer();
});

// Global handlers to improve stability: log unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: String(reason), timestamp: new Date().toISOString() });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err?.message || String(err), timestamp: new Date().toISOString() });
  // It's safer to exit after an uncaught exception in Node to avoid undefined state
  setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.close();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient.close();
  server.close(() => process.exit(0));
});
