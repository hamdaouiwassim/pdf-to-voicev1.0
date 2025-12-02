const express = require('express');
const labController = require('../controllers/labController');
const validation = require('../middleware/validation');

const router = express.Router();

router.post(
    '/python/run',
    validation.validatePythonLabRequest,
    labController.runPythonLab,
);

module.exports = router;

