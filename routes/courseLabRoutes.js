const express = require('express');
const router = express.Router({ mergeParams: true }); // Important: mergeParams allows access to parent route params
const labManagementController = require('../controllers/labManagementController');

// GET /api/courses/:courseId/labs - Get labs by course ID
router.get('/', labManagementController.getLabsByCourse);

module.exports = router;
