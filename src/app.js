const express = require('express');
const path = require('path');
const morgan = require('morgan');
const callRoutes = require('./routes/callRoutes');
const callController = require('./controllers/callController');
const db = require('./services/databaseService');
const sessionStore = require('./utils/sessionStore');

const app = express();

// Twilio sends application/x-www-form-urlencoded requests for webhooks
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));

// Serve the dashboard static files
app.use('/dashboard', express.static(path.join(__dirname, '..', 'public', 'dashboard')));

// Mount router
app.use('/api/call', callRoutes);

// Also mount the incoming webhook directly to ensure exact path matches
app.post('/api/call/incoming', callController.incoming);
app.get('/api/call/incoming', callController.incoming);

// ──────────────────────────────────────────────────────────────
// Dashboard API endpoints (backed by PostgreSQL)
// ──────────────────────────────────────────────────────────────

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json(stats || { error: 'Database not ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/calls', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const calls = await db.getRecentCalls(limit);
    res.json({ count: calls.length, calls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/calls/:callSid/events', async (req, res) => {
  try {
    const events = await db.getCallEvents(req.params.callSid);
    res.json({ count: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/events', async (req, res) => {
  try {
    const stats = await db.getEventStats();
    res.json(stats || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// AGENT PANEL — Live call monitoring + feedback
// ──────────────────────────────────────────────────────────────

// Get all active/live calls (in-memory session state)
app.get('/api/agent/live-calls', (req, res) => {
  try {
    const activeSessions = sessionStore.getAllActiveSessions();
    res.json({ count: activeSessions.length, calls: activeSessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit agent feedback/correction for a call
app.post('/api/agent/feedback', async (req, res) => {
  try {
    const feedback = req.body;
    if (!feedback.callSid && !feedback.originalText) {
      return res.status(400).json({ error: 'callSid or originalText required' });
    }
    const result = await db.insertFeedback({
      callSid: feedback.callSid,
      languageCode: feedback.languageCode,
      turnNumber: feedback.turnNumber || 0,
      originalText: feedback.originalText,
      aiInterpretation: feedback.aiInterpretation,
      correctedInterpretation: feedback.correctedInterpretation,
      confirmationStatus: feedback.confirmationStatus || 'unknown',
      correctedBy: feedback.correctedBy || 'agent',
      originalIntent: feedback.originalIntent,
      correctedIntent: feedback.correctedIntent,
      originalEmotion: feedback.originalEmotion,
      correctedEmotion: feedback.correctedEmotion,
      dialect: feedback.dialect,
      agentNotes: feedback.agentNotes
    });
    res.json({ success: true, id: result?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get feedback statistics (for learning dashboard)
app.get('/api/agent/feedback/stats', async (req, res) => {
  try {
    const stats = await db.getFeedbackStats();
    res.json(stats || { error: 'Database not ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.redirect('/dashboard'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error in Express:', err);
  if (req.path && req.path.startsWith('/api/call')) {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say>Sorry, I am having trouble. Please try again.</Say>\n</Response>`;
    return res.type('text/xml').status(200).send(fallback);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize database on startup
db.initialize().then(ok => {
  if (ok) console.log('✅ PostgreSQL connected and schema ready');
  else console.log('⚠️ Running without PostgreSQL persistence');
}).catch(err => {
  console.error('PostgreSQL init failed:', err.message);
});

module.exports = app;
