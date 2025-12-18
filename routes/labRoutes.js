const express = require('express');
const labController = require('../controllers/labController');
const validation = require('../middleware/validation');

const router = express.Router();

router.post(
    '/python/run',
    validation.validatePythonLabRequest,
    labController.runPythonLab,
);

// POST /api/lab/feedback - Get specific feedback audio (e.g. empty input)
router.post('/feedback', labController.getFeedbackAudio);

module.exports = router;
