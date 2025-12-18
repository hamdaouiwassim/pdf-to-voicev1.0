const express = require('express');
const router = express.Router();
const labManagementController = require('../controllers/labManagementController');
const validation = require('../middleware/validation');

// GET /api/exercises/:exerciseId - Get an exercise by ID
router.get('/:exerciseId', validation.validateDocId, labManagementController.getExercise);

// PUT /api/exercises/:exerciseId - Update an exercise
router.put('/:exerciseId', validation.validateDocId, labManagementController.updateExercise);

// DELETE /api/exercises/:exerciseId - Delete an exercise
router.delete('/:exerciseId', validation.validateDocId, labManagementController.deleteExercise);

// GET /api/exercises/:exerciseId/pdf - Get exercise PDF file
router.get('/:exerciseId/pdf', validation.validateDocId, labManagementController.getExercisePdf);

module.exports = router;

