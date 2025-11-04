const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');

// GET /api/audio/:audioId - Serve audio file
router.get('/:audioId', audioController.getAudio);

module.exports = router;

