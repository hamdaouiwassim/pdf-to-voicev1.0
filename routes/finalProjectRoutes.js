const express = require('express');
const router = express.Router({ mergeParams: true });
const finalProjectController = require('../controllers/finalProjectController');
const validation = require('../middleware/validation');

// Note: fileUpload middleware is already applied globally in server.js
// Final project routes
// GET /api/courses/:courseId/final-project - Get final project for a course
router.get('/', finalProjectController.getFinalProjectByCourse);

// POST /api/courses/:courseId/final-project - Create final project
router.post('/', finalProjectController.createFinalProject);

// PUT /api/courses/:courseId/final-project - Update final project
router.put('/', finalProjectController.updateFinalProject);

// DELETE /api/courses/:courseId/final-project - Delete final project
router.delete('/', finalProjectController.deleteFinalProject);

// Document routes
// POST /api/courses/:courseId/final-project/documents - Add document to final project
router.post('/documents', finalProjectController.addDocument);

// GET /api/courses/:courseId/final-project/documents/:documentId/pdf - Get document PDF
router.get('/documents/:documentId/pdf', validation.validateDocId, finalProjectController.getDocumentPdf);

// DELETE /api/courses/:courseId/final-project/documents/:documentId - Delete document
router.delete('/documents/:documentId', validation.validateDocId, finalProjectController.deleteDocument);

// Submission routes
// IMPORTANT: More specific routes must come before less specific ones
// GET /api/courses/:courseId/final-project/submission/file - Get submission file
router.get('/submission/file', finalProjectController.getSubmissionFile);

// GET /api/courses/:courseId/final-project/submission - Get user's submission
router.get('/submission', finalProjectController.getSubmission);

// POST /api/courses/:courseId/final-project/submission - Create submission
router.post('/submission', finalProjectController.submitWork);

// PUT /api/courses/:courseId/final-project/submission - Update submission
router.put('/submission', finalProjectController.submitWork);

module.exports = router;
