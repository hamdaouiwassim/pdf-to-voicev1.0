const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');
const validation = require('../middleware/validation');

// GET /api/audio/:audioId - Serve audio file
router.get('/:audioId', validation.validateAudioId, audioController.getAudio);

module.exports = router;

