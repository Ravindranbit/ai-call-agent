const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const server = http.createServer(app);

server.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
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
