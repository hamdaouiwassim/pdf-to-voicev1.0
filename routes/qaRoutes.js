const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');
const validation = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');

// POST /api/qa - Answer questions using free AI or Google Search
router.post('/', validation.validateQuestionRequest, validation.validateUseFreeAI, qaController.answerQuestion);

// GET /api/qa/history - Get user QA history for a course
router.get('/history', requireAuth, qaController.getHistory);

module.exports = router;

