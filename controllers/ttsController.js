const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const dbUtils = require('../utils/dbUtils');
const geminiService = require('../services/geminiService');
const textUtils = require('../utils/textUtils');
const pdfTextExtractor = require('../utils/pdfTextExtractor');
const config = require('../config/config');

/**
 * Generate or retrieve cached TTS audio for a document
 * POST /api/tts
 */
async function generateTTS(req, res) {
    try {
        // Document ID validation is handled by middleware (validateDocIdInBody)
        const { docId, courseId } = req.body; // Support courseId for chapters

        // Enforce page-by-page audio for chapters (no single file generation)
        if (courseId) {
            return res.status(400).json({
                error: 'Single-file TTS is disabled for chapters',
                details: 'Use /api/courses/:courseId/chapters/:chapterId/generate-page-audio instead.'
            });
        }

        // If docId matches a chapter, block single-file generation as well
        try {
            const db = require('../config/database');
            const chapters = await db.query(
                'SELECT id, course_id FROM chapters WHERE id = ? LIMIT 1',
                [docId]
            );
            if (chapters.length > 0) {
                return res.status(400).json({
                    error: 'Single-file TTS is disabled for chapters',
                    details: `Use /api/courses/${chapters[0].course_id}/chapters/${docId}/generate-page-audio instead.`
                });
            }
        } catch (lookupError) {
            console.warn('[TTS] Chapter lookup failed, continuing as document:', lookupError.message);
        }

        // 1. DATA RETRIEVAL - Use TEXT PDF extraction (same as page timings)
        // This ensures perfect synchronization between timings and TTS audio
        console.log(`[TTS] Extracting text from TEXT PDF for ${docId}${courseId ? ` (chapter in course ${courseId})` : ''}...`);
        
        let text;
        let source = 'text_pdf_extraction';

        try {
            // Extract text directly from TEXT PDF using same logic as page timings
            // This guarantees perfect synchronization
            text = await pdfTextExtractor.extractTextForTTSById(docId, courseId);
            console.log(`[TTS] Extracted text from TEXT PDF, length: ${text.length} chars`);
        } catch (extractionError) {
            console.warn(`[TTS] Failed to extract from TEXT PDF (${extractionError.message}), falling back to DB/file system...`);
            
            // Fallback to original method (for backward compatibility)
            text = await dbUtils.getChapterTextById(docId);
            source = 'database';

            if (!text) {
                console.log(`[TTS] Text not found in DB for ${docId}, checking file system...`);
                text = await fileUtils.getAITextByDocId(docId);

                if (text) {
                    source = 'file_document';
                } else {
                    // Try as chapter from file system
                    text = await fileUtils.getChapterText(docId);
                    if (text) {
                        source = 'file_chapter';
                    }
                }
            }

            if (!text) {
                console.error(`[TTS] No text found for ${docId} (checked TEXT PDF, DB and files)`);
                return res.status(404).json({ 
                    error: 'Document or chapter content not found',
                    details: 'Could not extract text from TEXT PDF, and no text found in database or file system.'
                });
            }

            // Clean fallback text (remove markers to match page timings)
            text = textUtils.removeSlideMarkers(text);
            console.log(`[TTS] Using fallback source: ${source}, cleaned length: ${text.length} chars`);
        }

        if (!text || text.trim().length === 0) {
            return res.status(404).json({ error: 'No text content found for TTS generation' });
        }

        // Text is already cleaned (no "next slide" or "Titan Academy")
        // This matches exactly with page timings calculation

        // 2. CACHE CHECK
        // Check for cached audio (async) - use new structure if courseId provided
        const audioType = courseId ? 'chapters' : null;
        if (await fileUtils.audioFileExists(docId, courseId, audioType)) {
            console.log(`[TTS] Serving cached audio for doc ID: ${docId}${courseId ? ` (course: ${courseId})` : ''}`);
            try {
                const fileBuffer = await fileUtils.readAudioFile(docId, courseId, audioType);
                return res.json({
                    audioData: fileBuffer.toString('base64'),
                    mimeType: 'audio/wav'
                });
            } catch (error) {
                console.warn(`[TTS] Failed to read cached file, regenerating. Error: ${error.message}`);
                // Fall through to regeneration
            }
        }

        // 3. GENERATION (SMART FALLBACK)
        console.log(`[TTS] Cache miss. Generating new voice for ID: ${docId} using Gemini TTS`);

        // Use only Gemini TTS
        const result = await geminiService.generateTTS(text, config.TTS_VOICE_DOCUMENT);
        const pcmBuffer = result.pcmBuffer;
        
        // Convert PCM to WAV and save (using new structure if courseId provided)
        const wavBuffer = audioUtils.pcmToWav(pcmBuffer);
        await fileUtils.saveAudioFile(docId, wavBuffer, courseId, audioType);

        console.log(`[TTS] Generated via Gemini TTS. Saved cache${courseId ? ` (course: ${courseId})` : ''}.`);

        return res.json({
            audioData: wavBuffer.toString('base64'),
            mimeType: 'audio/wav'
        });

    } catch (error) {
        console.error("[TTS Error]:", error);
        res.status(500).json({
            error: 'TTS generation failed.',
            details: error.message
        });
    }
}

module.exports = {
    generateTTS,
};

