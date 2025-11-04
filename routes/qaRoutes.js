const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');

// POST /api/qa - Answer questions using Google Search
router.post('/', qaController.answerQuestion);

module.exports = router;

