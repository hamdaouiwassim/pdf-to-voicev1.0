const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const fileUtils = require('../utils/fileUtils');
const pdfUtils = require('../utils/pdfUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const config = require('../config/config');
const path = require('path');

/**
 * Extract text from uploaded PDF and save metadata
 * POST /api/extract-text
 */
async function extractText(req, res) {
    try {
        if (!req.files || !req.files.pdfFile) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        // Validate file type
        if (!config.ALLOWED_MIME_TYPES.includes(req.files.pdfFile.mimetype)) {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        // Validate file size
        if (req.files.pdfFile.size > config.MAX_FILE_SIZE) {
            return res.status(400).json({ 
                error: `File size exceeds ${config.MAX_FILE_SIZE / 1024 / 1024}MB` 
            });
        }

        const pdfBuffer = req.files.pdfFile.data;
        const result = await pdfParse(pdfBuffer);

        // Generate unique ID for the document
        const docId = crypto.randomUUID();
        const filename = `${docId}.pdf`;
        const pdfFilePath = path.join(config.UPLOADS_DIR, filename);

        // Save PDF file
        await pdfUtils.createPDF(pdfFilePath, req.files.pdfFile.name, result.text);

        // Create and save JSON sidecar file
        const sidecarData = {
            id: docId,
            title: req.files.pdfFile.name.replace('.pdf', ''),
            text: result.text,
            filename: filename,
            length: result.text.length,
            timestamp: new Date().toISOString()
        };

        await fileUtils.saveDocumentMetadata(sidecarData);

        res.json({
            text: result.text,
            docId: docId,
            filename: filename
        });
    } catch (err) {
        console.error("Error parsing PDF:", err.message);
        res.status(500).json({ 
            error: "Failed to parse PDF. The file may be corrupted or invalid.",
            details: err.message 
        });
    }
}

/**
 * Create a new document (generate PDF from text)
 * POST /api/documents
 */
async function createDocument(req, res) {
    try {
        const { title, text } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'Valid title is required' });
        }

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'Valid text is required' });
        }

        const docId = crypto.randomUUID();
        const filename = `${docId}.pdf`;
        const pdfFilePath = path.join(config.UPLOADS_DIR, filename);

        // Create and save PDF file
        await pdfUtils.createPDF(pdfFilePath, title, text);

        // Create and save JSON sidecar file
        const sidecarData = {
            id: docId,
            title: title.trim(),
            text: text.trim(),
            filename: filename,
            length: text.length,
            timestamp: new Date().toISOString()
        };

        await fileUtils.saveDocumentMetadata(sidecarData);

        console.log(`[FS] PDF saved to: ${filename}`);
        res.status(201).json({
            message: 'Document saved successfully.',
            id: docId,
            filename: filename
        });
    } catch (error) {
        console.error("[FS Error] Failed to save document:", error);
        res.status(500).json({ 
            error: 'Failed to save document to file system.',
            details: error.message 
        });
    }
}

/**
 * Get list of all documents
 * GET /api/documents
 */
async function getAllDocuments(req, res) {
    try {
        const documents = await fileUtils.getAllDocuments();
        res.json(documents);
    } catch (error) {
        console.error("[FS Error] Failed to list documents:", error.message);
        res.status(500).json({ 
            error: 'Failed to list documents from file system.',
            details: error.message 
        });
    }
}

/**
 * Summarize a document by docId and generate audio from the summary
 * GET /api/documents/:docId/summary
 */
async function summarizeDocument(req, res) {
    try {
        const { docId } = req.params;
        const { language } = req.query; // Optional language parameter (en, fr, etc.)

        if (!docId) {
            return res.status(400).json({ error: 'Document ID is required' });
        }

        // Get document text
        const text = await fileUtils.getAITextByDocId(docId);

        if (!text) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check for cached summary audio first
        const summaryAudioId = `${docId}-summary`;
        let wavBuffer = null;
        let summary = null;

        if (fileUtils.audioFileExists(summaryAudioId)) {
            console.log(`[Summary] Serving cached summary audio for doc ID: ${docId}`);
            try {
                wavBuffer = await fileUtils.readAudioFile(summaryAudioId);
                // We still need to get the summary text, so we'll generate it
                // Or we could cache the summary text too, but for now let's generate it
            } catch (error) {
                console.warn(`[Summary] Failed to read cached audio, regenerating. Error: ${error.message}`);
                // Fall through to regeneration
            }
        }

        // Generate summary
        console.log(`[Summary] Generating summary for doc ID: ${docId}`);
        summary = await geminiService.generateSummary(text, language || 'en');

        // Generate audio if not cached
        if (!wavBuffer) {
            console.log(`[Summary] Generating audio from summary for doc ID: ${docId}`);
            const { pcmBuffer } = await geminiService.generateTTS(summary, config.TTS_VOICE_DOCUMENT);
            wavBuffer = audioUtils.pcmToWav(pcmBuffer);
            await fileUtils.saveAudioFile(summaryAudioId, wavBuffer);
            console.log(`[Summary] Saved summary audio cache for doc ID: ${docId}`);
        }

        res.json({
            docId: docId,
            summary: summary,
            audioData: wavBuffer.toString('base64'),
            mimeType: 'audio/wav',
            originalLength: text.length,
            summaryLength: summary.length,
            type: 'summary',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Summary Error]:", error);
        res.status(500).json({ 
            error: 'Failed to generate summary and audio.',
            details: error.message 
        });
    }
}

/**
 * Generate audio from document summary
 * GET /api/documents/:docId/summary/audio
 */
async function generateSummaryAudio(req, res) {
    try {
        const { docId } = req.params;
        const { language } = req.query; // Optional language parameter (en, fr, etc.)

        if (!docId) {
            return res.status(400).json({ error: 'Document ID is required' });
        }

        // Get document text
        const text = await fileUtils.getAITextByDocId(docId);

        if (!text) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check for cached summary audio (use a different ID to distinguish from full document audio)
        const summaryAudioId = `${docId}-summary`;
        
        if (fileUtils.audioFileExists(summaryAudioId)) {
            console.log(`[Summary Audio] Serving cached audio for doc ID: ${docId}`);
            try {
                const fileBuffer = await fileUtils.readAudioFile(summaryAudioId);
                return res.json({
                    audioData: fileBuffer.toString('base64'),
                    mimeType: 'audio/wav',
                    docId: docId,
                    type: 'summary'
                });
            } catch (error) {
                console.warn(`[Summary Audio] Failed to read cached file, regenerating. Error: ${error.message}`);
                // Fall through to regeneration
            }
        }

        // Generate summary
        console.log(`[Summary Audio] Generating summary and audio for doc ID: ${docId}`);
        const summary = await geminiService.generateSummary(text, language || 'en');

        // Generate TTS audio from summary
        const { pcmBuffer } = await geminiService.generateTTS(summary, config.TTS_VOICE_DOCUMENT);

        // Convert PCM to WAV and save
        const wavBuffer = audioUtils.pcmToWav(pcmBuffer);
        await fileUtils.saveAudioFile(summaryAudioId, wavBuffer);

        console.log(`[Summary Audio] Saved audio cache for doc ID: ${docId}`);

        res.json({
            audioData: wavBuffer.toString('base64'),
            mimeType: 'audio/wav',
            docId: docId,
            summary: summary,
            summaryLength: summary.length,
            type: 'summary',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Summary Audio Error]:", error);
        res.status(500).json({ 
            error: 'Failed to generate summary audio.',
            details: error.message 
        });
    }
}

module.exports = {
    extractText,
    createDocument,
    getAllDocuments,
    summarizeDocument,
    generateSummaryAudio,
};

