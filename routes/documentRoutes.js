const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// POST /api/extract-text - Extract text from uploaded PDF
router.post('/extract-text', documentController.extractText);

// POST /api/documents - Create a new document (generate PDF from text)
router.post('/', documentController.createDocument);

// GET /api/documents - Get list of all documents
router.get('/', documentController.getAllDocuments);

// GET /api/documents/:docId/summary/audio - Generate audio from document summary (must come before /:docId/summary)
router.get('/:docId/summary/audio', documentController.generateSummaryAudio);

// GET /api/documents/:docId/summary - Summarize a document
router.get('/:docId/summary', documentController.summarizeDocument);

module.exports = router;

