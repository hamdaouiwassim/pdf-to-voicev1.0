const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access courseId from parent route
const chapterController = require('../controllers/chapterController');
const quizController = require('../controllers/quizController');
const validation = require('../middleware/validation');

// POST /api/courses/:courseId/chapters - Create a new chapter
router.post('/', validation.validateChapterUpload, chapterController.createChapter);

// GET /api/courses/:courseId/chapters - Get all chapters in a course
router.get('/', chapterController.getChapters);

// GET /api/courses/:courseId/chapters/:chapterId - Get a chapter by ID
router.get('/:chapterId', validation.validateDocId, chapterController.getChapter);

// GET /api/courses/:courseId/chapters/:chapterId/file - Get chapter file (PDF or WebP)
router.get('/:chapterId/file', validation.validateDocId, chapterController.getChapterFile);

// GET /api/courses/:courseId/chapters/:chapterId/lip-sync - Serve lip sync JSON
router.get('/:chapterId/lip-sync', validation.validateDocId, chapterController.getChapterLipSync);

// GET /api/courses/:courseId/chapters/:chapterId/lip-sync/:pageNumber - Serve page lip sync JSON
router.get('/:chapterId/lip-sync/:pageNumber', validation.validateDocId, chapterController.getChapterPageLipSync);

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

// Quiz routes (public - for students)
// GET /api/courses/:courseId/chapters/:chapterId/quiz - Get quiz questions for a chapter
router.get('/:chapterId/quiz', validation.validateDocId, quizController.getQuizQuestions);

// POST /api/courses/:courseId/chapters/:chapterId/quiz/submit - Submit quiz answers
router.post('/:chapterId/quiz/submit', validation.validateDocId, quizController.submitQuiz);

// GET /api/courses/:courseId/chapters/:chapterId/quiz/attempts - Get quiz attempts for user
router.get('/:chapterId/quiz/attempts', validation.validateDocId, quizController.getQuizAttempts);

// GET /api/courses/:courseId/chapters/:chapterId/quiz/attempts/:attemptId - Get specific quiz attempt
router.get('/:chapterId/quiz/attempts/:attemptId', validation.validateDocId, quizController.getQuizAttempt);

// POST /api/courses/:courseId/chapters/:chapterId/quiz/feedback - Get quiz feedback with avatar audio
router.post('/:chapterId/quiz/feedback', validation.validateDocId, quizController.getQuizFeedback);

// GET /api/courses/:courseId/chapters/:chapterId/quiz/audio/:audioId - Serve quiz feedback audio (media)
router.get('/:chapterId/quiz/audio/:audioId', validation.validateDocId, validation.validateAudioId, quizController.getQuizAudio);

// GET /api/courses/:courseId/chapters/:chapterId/quiz/lipsync/:audioId - Serve quiz lip sync JSON
router.get('/:chapterId/quiz/lipsync/:audioId', validation.validateDocId, validation.validateAudioId, quizController.getQuizLipSync);

// Quiz admin routes (admin only)
// GET /api/courses/:courseId/chapters/:chapterId/quiz/admin - Get all quiz questions with answers (admin)
router.get('/:chapterId/quiz/admin', validation.validateDocId, quizController.getQuizQuestionsAdmin);

// POST /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions - Create a quiz question (admin)
router.post('/:chapterId/quiz/admin/questions', validation.validateDocId, quizController.createQuizQuestion);

// PUT /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions/:questionId - Update a quiz question (admin)
router.put('/:chapterId/quiz/admin/questions/:questionId', validation.validateDocId, quizController.updateQuizQuestion);

// DELETE /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions/:questionId - Delete a quiz question (admin)
router.delete('/:chapterId/quiz/admin/questions/:questionId', validation.validateDocId, quizController.deleteQuizQuestion);

module.exports = router;

