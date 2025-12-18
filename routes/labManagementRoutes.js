const express = require('express');
const router = express.Router();
const labManagementController = require('../controllers/labManagementController');
const validation = require('../middleware/validation');

// Lab routes
// GET /api/labs OR /api/courses/:courseId/labs - Handle both cases
router.get('/', (req, res, next) => {
    console.log('[Lab Routes] GET / - Path:', req.path, 'Params:', req.params, 'Query:', req.query);
    
    // Check if courseId is in params (when mounted at /api/courses/:courseId/labs)
    if (req.params.courseId) {
        console.log('[Lab Routes] Calling getLabsByCourse for courseId:', req.params.courseId);
        return labManagementController.getLabsByCourse(req, res, next);
    }
    
    // Otherwise, use getAllLabs (when mounted at /api/labs)
    console.log('[Lab Routes] Calling getAllLabs');
    return labManagementController.getAllLabs(req, res, next);
});

// POST /api/labs - Create a new lab
router.post('/', labManagementController.createLab);

// GET /api/labs/:labId - Get a lab by ID
router.get('/:labId', validation.validateDocId, labManagementController.getLab);

// PUT /api/labs/:labId - Update a lab
router.put('/:labId', validation.validateDocId, labManagementController.updateLab);

// DELETE /api/labs/:labId - Delete a lab
router.delete('/:labId', validation.validateDocId, labManagementController.deleteLab);

// Exercise routes under labs
// GET /api/labs/:labId/exercises - Get all exercises for a lab
router.get('/:labId/exercises', validation.validateDocId, labManagementController.getExercisesByLab);

// POST /api/labs/:labId/exercises - Create a new exercise
router.post('/:labId/exercises', validation.validateDocId, labManagementController.createExercise);

module.exports = router;

