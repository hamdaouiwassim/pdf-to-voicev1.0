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

// POST /api/courses/:courseId/chapters/:chapterId/regenerate-tts - Regenerate TTS (delete old and regenerate)
router.post('/:chapterId/regenerate-tts', validation.validateDocId, chapterController.regenerateChapterTTS);

// POST /api/courses/:courseId/chapters/:chapterId/regenerate-lipsync - Regenerate lip sync (delete old and regenerate)
router.post('/:chapterId/regenerate-lipsync', validation.validateDocId, chapterController.regenerateChapterLipSync);

// GET /api/courses/:courseId/chapters/:chapterId/page-timings - Get page timings for a chapter
router.get('/:chapterId/page-timings', validation.validateDocId, chapterController.getChapterPageTimings);

// POST /api/courses/:courseId/chapters/:chapterId/generate-page-audio - Generate TTS audio for all pages
router.post('/:chapterId/generate-page-audio', validation.validateDocId, chapterController.generateChapterPageAudio);

// GET /api/courses/:courseId/chapters/:chapterId/audio/:pageNumber - Get audio file for a specific page
router.get('/:chapterId/audio/:pageNumber', validation.validateDocId, chapterController.getChapterPageAudio);

// GET /api/courses/:courseId/chapters/:chapterId/statements - Get chapter statements
router.get('/:chapterId/statements', validation.validateDocId, chapterController.getChapterStatements);

// PUT /api/courses/:courseId/chapters/:chapterId - Update a chapter
// Note: File uploads are optional, so we don't use validateChapterUpload middleware
router.put('/:chapterId', validation.validateDocId, chapterController.updateChapter);

// DELETE /api/courses/:courseId/chapters/:chapterId - Delete a chapter
router.delete('/:chapterId', validation.validateDocId, chapterController.deleteChapter);

module.exports = router;

