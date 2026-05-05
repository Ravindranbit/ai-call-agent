const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

router.post('/incoming', callController.incoming);
router.post('/gather', callController.gather);
router.get('/debug/gathers', callController.debugGathers);
router.post('/converse', callController.converse);
router.post('/status', callController.status);
router.post('/make', callController.makeCall);
router.get('/make', callController.makeCall);
router.get('/make-all', callController.makeCallAll);

// 📊 Analytics endpoints (Phase 14)
router.get('/analytics', callController.getAnalytics);
router.get('/analytics/calls', callController.getRecentCalls);

module.exports = router;
