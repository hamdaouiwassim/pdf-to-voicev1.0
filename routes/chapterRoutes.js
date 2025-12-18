const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access courseId from parent route
const chapterController = require('../controllers/chapterController');
const validation = require('../middleware/validation');

// POST /api/courses/:courseId/chapters - Create a new chapter
router.post('/', validation.validateChapterUpload, chapterController.createChapter);

// GET /api/courses/:courseId/chapters - Get all chapters in a course
router.get('/', chapterController.getChapters);

// GET /api/courses/:courseId/chapters/:chapterId - Get a chapter by ID
router.get('/:chapterId', validation.validateDocId, chapterController.getChapter);

// GET /api/courses/:courseId/chapters/:chapterId/file - Get chapter file (PDF or WebP)
router.get('/:chapterId/file', validation.validateDocId, chapterController.getChapterFile);

// GET /api/courses/:courseId/chapters/:chapterId/summary - Summarize a chapter
router.get('/:chapterId/summary', validation.validateDocId, validation.validateLanguage, chapterController.summarizeChapter);

// POST /api/courses/:courseId/chapters/:chapterId/lipsync - Generate lip sync for a chapter
router.post('/:chapterId/lipsync', validation.validateDocId, chapterController.generateChapterLipSync);

// GET /api/courses/:courseId/chapters/:chapterId/page-timings - Get page timings for a chapter
router.get('/:chapterId/page-timings', validation.validateDocId, chapterController.getChapterPageTimings);

// GET /api/courses/:courseId/chapters/:chapterId/statements - Get chapter statements
router.get('/:chapterId/statements', validation.validateDocId, chapterController.getChapterStatements);

// PUT /api/courses/:courseId/chapters/:chapterId - Update a chapter
// Note: File uploads are optional, so we don't use validateChapterUpload middleware
router.put('/:chapterId', validation.validateDocId, chapterController.updateChapter);

// DELETE /api/courses/:courseId/chapters/:chapterId - Delete a chapter
router.delete('/:chapterId', validation.validateDocId, chapterController.deleteChapter);

module.exports = router;

