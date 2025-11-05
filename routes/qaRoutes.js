const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');
const validation = require('../middleware/validation');

// POST /api/qa - Answer questions using free AI or Google Search
router.post('/', validation.validateQuestionRequest, validation.validateUseFreeAI, qaController.answerQuestion);

module.exports = router;

