const express = require('express');
const router = express.Router();
const ttsController = require('../controllers/ttsController');
const validation = require('../middleware/validation');

// POST /api/tts - Generate or retrieve cached TTS audio
router.post('/', validation.validateDocIdInBody, ttsController.generateTTS);

module.exports = router;

