const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const validation = require('../middleware/validation');

// GET /api/documents - Get list of all documents
router.get('/', documentController.getAllDocuments);

// POST /api/documents - Extract text from uploaded PDF and save document
router.post('/', validation.validateFileUpload, documentController.createDocument);

// DELETE /api/documents/:docId - Delete a document and its assets
router.delete('/:docId', validation.validateDocId, documentController.deleteDocument);

// POST /api/documents/:docId/lipsync - Generate lip sync JSON via Rhubarb
router.post('/:docId/lipsync', validation.validateDocId, documentController.generateLipSync);

// GET /api/documents/:docId/file - Get PDF file by document ID
router.get('/:docId/file', validation.validateDocId, documentController.getDocumentFile);

// GET /api/documents/:docId/summary/audio - Generate audio from document summary (must come before /:docId/summary)
router.get('/:docId/summary/audio', validation.validateDocId, validation.validateLanguage, documentController.generateSummaryAudio);

// GET /api/documents/:docId/summary - Summarize a document
router.get('/:docId/summary', validation.validateDocId, validation.validateLanguage, documentController.summarizeDocument);

// GET /api/documents/:docId/page-timings - Get page timings for a document
router.get('/:docId/page-timings', validation.validateDocId, documentController.getPageTimings);

module.exports = router;

