const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const fsPromises = require('fs').promises;
const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const localTTSService = require('../services/localTTSService');
const config = require('../config/config');
const constants = require('../utils/constants');
const path = require('path');

/**
 * Extract text from uploaded PDF and save metadata
 * POST /api/extract-text
 */
async function createDocument(req, res) {
    try {
        // File validation is handled by middleware (validateFileUpload)
        // Additional validation only if needed
        const pdfBuffer = req.files.pdfFile.data;
        
        // Generate unique ID for the document
        const docId = crypto.randomUUID();
        const filename = `${docId}${constants.FILE_EXTENSIONS.PDF}`;
        const pdfFilePath = path.join(config.UPLOADS_DIR, filename);

        // Parse PDF and save files in parallel for better performance
        const [result] = await Promise.all([
            pdfParse(pdfBuffer),
            fsPromises.writeFile(pdfFilePath, pdfBuffer)
        ]);

        // Create and save JSON sidecar file
        const sidecarData = {
            id: docId,
            title: req.files.pdfFile.name.replace(constants.FILE_EXTENSIONS.PDF, ''),
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
 * Get PDF file by document ID
 * GET /api/documents/:docId/file
 */
async function getDocumentFile(req, res) {
    try {
        // Document ID validation is handled by middleware (validateDocId)
        const { docId } = req.params;
        const pdfFilePath = path.join(config.UPLOADS_DIR, `${docId}${constants.FILE_EXTENSIONS.PDF}`);

        // Check if file exists (async)
        if (!(await fileUtils.fileExists(pdfFilePath))) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        // Set appropriate headers and send file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${docId}${constants.FILE_EXTENSIONS.PDF}"`);
        res.sendFile(path.resolve(pdfFilePath));
    } catch (error) {
        console.error("[Document File Error]:", error);
        res.status(500).json({ 
            error: 'Failed to retrieve document file.',
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
        // Document ID and language validation handled by middleware
        const { docId } = req.params;
        const { language } = req.query; // Optional language parameter (en, fr, etc.)

        // Get document metadata (includes cached summary if available)
        const metadata = await fileUtils.getDocumentMetadata(docId);
        if (!metadata) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        const summaryAudioId = `${docId}${constants.AUDIO_PREFIXES.SUMMARY}`;
        let wavBuffer = null;
        let summary = null;

        // Default to French for summaries
        const summaryLanguage = language || 'fr';
        
        // Check for cached summary text and audio
        const hasCachedSummary = metadata.summary && metadata.summaryLanguage === summaryLanguage;
        const hasCachedAudio = await fileUtils.audioFileExists(summaryAudioId);

        if (hasCachedSummary && hasCachedAudio) {
            console.log(`[Summary] Serving cached summary and audio for doc ID: ${docId}`);
            summary = metadata.summary;
            wavBuffer = await fileUtils.readAudioFile(summaryAudioId);
        } else {
            // Get document text for summary generation
            const text = metadata.text || await fileUtils.getAITextByDocId(docId);
            
            if (!text) {
                return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
            }

            // Generate summary (default to French)
            console.log(`[Summary] Generating summary for doc ID: ${docId}`);
            summary = await geminiService.generateSummary(text, summaryLanguage);

            // Cache summary in metadata
            metadata.summary = summary;
            metadata.summaryLanguage = summaryLanguage;
            metadata.summaryTimestamp = new Date().toISOString();
            await fileUtils.saveDocumentMetadata(metadata);

            // Generate audio if not cached (use French voice)
            // Priority: Local TTS (offline) > Edge TTS > Gemini TTS
            if (!hasCachedAudio) {
                console.log(`[Summary] Generating audio from summary for doc ID: ${docId}`);
                try {
                    // Try local TTS first (works offline, good for localhost)
                    if (process.platform === 'win32') {
                        wavBuffer = await localTTSService.generateTTSLocal(summary, summaryLanguage === 'fr' ? 'fr-FR' : 'en-US');
                        console.log(`[Summary] Generated audio using Local TTS (Windows SAPI, ${summaryLanguage})`);
                    } else {
                        throw new Error('Local TTS not available on this platform');
                    }
                } catch (localTtsError) {
                    console.warn(`[Summary] Local TTS failed, trying Edge TTS:`, localTtsError.message);
                    try {
                        // Try Edge TTS for better French voice quality
                        const edgeTTSService = require('../services/edgeTTSService');
                        wavBuffer = await edgeTTSService.generateTTSWithEdge(summary, summaryLanguage === 'fr' ? 'fr-FR' : 'en-US');
                        console.log(`[Summary] Generated audio using Edge TTS (${summaryLanguage})`);
                    } catch (edgeError) {
                        console.warn(`[Summary] Edge TTS failed, trying Gemini TTS:`, edgeError.message);
                        // Fallback to Gemini TTS
                        try {
                            const { pcmBuffer } = await geminiService.generateTTS(summary, config.TTS_VOICE_DOCUMENT);
                            wavBuffer = audioUtils.pcmToWav(pcmBuffer);
                            console.log(`[Summary] Generated audio using Gemini TTS`);
                        } catch (geminiError) {
                            // If all fail, throw error
                            throw new Error(`All TTS services failed. Local: ${localTtsError.message}, Edge: ${edgeError.message}, Gemini: ${geminiError.message}`);
                        }
                    }
                }
                await fileUtils.saveAudioFile(summaryAudioId, wavBuffer);
                console.log(`[Summary] Saved summary audio cache for doc ID: ${docId}`);
            } else {
                wavBuffer = await fileUtils.readAudioFile(summaryAudioId);
            }
        }

        res.json({
            docId: docId,
            summary: summary,
            audioData: wavBuffer.toString('base64'),
            mimeType: 'audio/wav',
            originalLength: metadata.length || metadata.text?.length || 0,
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
        // Document ID and language validation handled by middleware
        const { docId } = req.params;
        const { language } = req.query; // Optional language parameter (en, fr, etc.)

        // Get document metadata
        const metadata = await fileUtils.getDocumentMetadata(docId);
        if (!metadata) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        // Default to French for summaries
        const summaryLanguage = language || 'fr';
        
        // Check if we have cached audio that matches the requested language
        const summaryAudioId = `${docId}${constants.AUDIO_PREFIXES.SUMMARY}`;
        const hasCachedAudio = await fileUtils.audioFileExists(summaryAudioId);
        const cachedAudioLanguageMatches = metadata.summaryLanguage === summaryLanguage;
        
        // Only serve cached audio if it matches the requested language
        if (hasCachedAudio && cachedAudioLanguageMatches && metadata.summary) {
            console.log(`[Summary Audio] Serving cached audio for doc ID: ${docId} (language: ${summaryLanguage})`);
            const fileBuffer = await fileUtils.readAudioFile(summaryAudioId);
            return res.json({
                audioData: fileBuffer.toString('base64'),
                mimeType: 'audio/wav',
                docId: docId,
                summary: metadata.summary,
                type: 'summary'
            });
        }

        // Get document text
        const text = metadata.text || await fileUtils.getAITextByDocId(docId);
        if (!text) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }
        
        // Generate summary (use cached if available and same language)
        let summary = metadata.summary && metadata.summaryLanguage === summaryLanguage
            ? metadata.summary
            : await geminiService.generateSummary(text, summaryLanguage);

        // Cache summary if not already cached or language changed
        if (!metadata.summary || metadata.summaryLanguage !== summaryLanguage) {
            metadata.summary = summary;
            metadata.summaryLanguage = summaryLanguage;
            metadata.summaryTimestamp = new Date().toISOString();
            await fileUtils.saveDocumentMetadata(metadata);
        }

        // Generate TTS audio from summary (regenerate if language mismatch or not cached)
        // Priority: Local TTS (offline) > Edge TTS > Gemini TTS
        let wavBuffer;
        const ttsLanguage = summaryLanguage === 'fr' ? 'fr-FR' : 
                           summaryLanguage === 'en' ? 'en-US' : 
                           summaryLanguage === 'es' ? 'es-ES' :
                           summaryLanguage === 'de' ? 'de-DE' :
                           summaryLanguage === 'it' ? 'it-IT' :
                           summaryLanguage === 'pt' ? 'pt-BR' : 'fr-FR';
        
        try {
            // Try local TTS first (works offline, good for localhost)
            if (process.platform === 'win32') {
                wavBuffer = await localTTSService.generateTTSLocal(summary, ttsLanguage);
                console.log(`[Summary Audio] Generated audio using Local TTS (Windows SAPI, ${summaryLanguage})`);
            } else {
                throw new Error('Local TTS not available on this platform');
            }
        } catch (localTtsError) {
            console.warn(`[Summary Audio] Local TTS failed, trying Edge TTS:`, localTtsError.message);
            try {
                // Try Edge TTS for better voice quality
                const edgeTTSService = require('../services/edgeTTSService');
                wavBuffer = await edgeTTSService.generateTTSWithEdge(summary, ttsLanguage);
                console.log(`[Summary Audio] Generated audio using Edge TTS (${summaryLanguage})`);
            } catch (edgeError) {
                console.warn(`[Summary Audio] Edge TTS failed, trying Gemini TTS:`, edgeError.message);
                // Fallback to Gemini TTS
                try {
                    const { pcmBuffer } = await geminiService.generateTTS(summary, config.TTS_VOICE_DOCUMENT);
                    wavBuffer = audioUtils.pcmToWav(pcmBuffer);
                    console.log(`[Summary Audio] Generated audio using Gemini TTS`);
                } catch (geminiError) {
                    // If all fail, throw error
                    throw new Error(`All TTS services failed. Local: ${localTtsError.message}, Edge: ${edgeError.message}, Gemini: ${geminiError.message}`);
                }
            }
        }
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
    createDocument,
    getAllDocuments,
    getDocumentFile,
    summarizeDocument,
    generateSummaryAudio,
};

