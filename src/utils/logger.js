function formatMessage(level, msg, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level.toUpperCase()} ${msg}${metaStr}`;
}

module.exports = {
  info: (msg, meta) => console.log(formatMessage('info', msg, meta)),
  warn: (msg, meta) => console.warn(formatMessage('warn', msg, meta)),
  error: (msg, meta) => console.error(formatMessage('error', msg, meta))
};
