const express = require('express');
const router = express.Router();
const ttsController = require('../controllers/ttsController');

// POST /api/tts - Generate or retrieve cached TTS audio
router.post('/', ttsController.generateTTS);

module.exports = router;

