const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const fsPromises = require('fs').promises;
const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const localTTSService = require('../services/localTTSService');
const lipSyncService = require('../services/lipSyncService');
const config = require('../config/config');
const constants = require('../utils/constants');
const path = require('path');

// PDF.js for page-by-page text extraction
let pdfjsLib;
try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (err) {
    // Fallback if pdfjs-dist is not installed
    console.warn('[PDF.js] pdfjs-dist not installed, will use pdf-parse fallback');
    pdfjsLib = null;
}

function buildStatementsFromText(docId, rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return [];
    }

    return rawText
        .split('\f')
        .map((pageText, index) => {
            const cleaned = pageText.replace(/\r/g, '').trim();
            if (!cleaned) {
                return null;
            }

            const lines = cleaned
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);

            if (lines.length === 0) {
                return null;
            }

            const title = lines[0].slice(0, 160) || `Exercice ${index + 1}`;

            return {
                id: `${docId}-statement-${index + 1}`,
                order: index + 1,
                page: index + 1,
                title,
                body: cleaned
            };
        })
        .filter(Boolean);
}

async function extractStatementsByPage(docId, pdfBuffer) {
    if (!pdfBuffer) {
        return [];
    }

    if (!pdfjsLib) {
        console.warn('[Statements] pdfjs-dist not available, falling back to text-based extraction.');
        return [];
    }

    try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
        const pdfDocument = await loadingTask.promise;
        const statements = [];

        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const lines = textContent.items
                .map(item => (item.str || '').trim())
                .filter(Boolean);

            const body = lines.join('\n').trim();
            if (!body) {
                continue;
            }

            const title = lines[0].slice(0, 160) || `Page ${pageNum}`;

            statements.push({
                id: `${docId}-statement-${pageNum}`,
                order: pageNum,
                page: pageNum,
                title,
                body
            });
        }

        return statements;
    } catch (error) {
        console.warn('[Statements] Failed to extract statements by page:', error.message);
        return [];
    }
}

async function ensureDocumentAudio(docId) {
    const audioPath = fileUtils.getAudioFilePath(docId);
    if (await fileUtils.audioFileExists(docId)) {
        return audioPath;
    }

    const text = await fileUtils.getAITextByDocId(docId);
    if (!text) {
        throw new Error('Document content not found for audio generation.');
    }

    const { pcmBuffer } = await geminiService.generateTTS(text, config.TTS_VOICE_DOCUMENT);
    const wavBuffer = audioUtils.pcmToWav(pcmBuffer);
    await fileUtils.saveAudioFile(docId, wavBuffer);
    return audioPath;
}

/**
 * Extract text from uploaded PDF and save metadata
 * Requires both textPdfFile (for TTS) and visualPdfFile (for display)
 * POST /api/documents
 */
async function createDocument(req, res) {
    try {
        // File validation is handled by middleware (validateFileUpload)
        // Both textPdfFile and visualPdfFile are required
        const textPdfBuffer = req.files.textPdfFile.data;
        const visualPdfBuffer = req.files.visualPdfFile.data;
        const courseName = typeof req.body?.courseName === 'string' ? req.body.courseName.trim() : '';
        const courseDescription = typeof req.body?.courseDescription === 'string' ? req.body.courseDescription.trim() : '';
        const statementsPdfFile = req.files?.statementsPdfFile;

        // Generate unique ID for the document
        const docId = crypto.randomUUID();

        // Text PDF for TTS, Visual PDF for display
        const textPdfFilename = `${docId}_text${constants.FILE_EXTENSIONS.PDF}`;
        const visualPdfFilename = `${docId}_visual${constants.FILE_EXTENSIONS.PDF}`;
        const statementsPdfFilename = statementsPdfFile ? `${docId}_statements${constants.FILE_EXTENSIONS.PDF}` : null;
        
        const textPdfPath = path.join(config.UPLOADS_DIR, textPdfFilename);
        const visualPdfPath = path.join(config.UPLOADS_DIR, visualPdfFilename);
        const statementsPdfPath = statementsPdfFilename ? path.join(config.UPLOADS_DIR, statementsPdfFilename) : null;

        // Parse PDFs and save files
        const textParsePromise = pdfParse(textPdfBuffer);
        const visualParsePromise = pdfParse(visualPdfBuffer);
        const writePromises = [
            fsPromises.writeFile(textPdfPath, textPdfBuffer),
            fsPromises.writeFile(visualPdfPath, visualPdfBuffer)
        ];

        let statementsParsePromise = null;
        if (statementsPdfFile) {
            statementsParsePromise = pdfParse(statementsPdfFile.data);
            writePromises.push(fsPromises.writeFile(statementsPdfPath, statementsPdfFile.data));
        }

        const parsePromises = [textParsePromise, visualParsePromise];
        if (statementsParsePromise) {
            parsePromises.push(statementsParsePromise);
        }

        const parseResults = await Promise.all(parsePromises);
        await Promise.all(writePromises);

        const textResult = parseResults[0];
        const visualResult = parseResults[1];
        const statementsResult = statementsParsePromise ? parseResults[2] : null;
        let statements = [];

        if (statementsPdfFile) {
            statements = await extractStatementsByPage(docId, statementsPdfFile.data);

            if (statements.length < (statementsParsePromise ? statementsResult?.numpages || 0 : 0)) {
                const pdfBuffer = statementsPdfFile.data;
                if (pdfjsLib) {
                    try {
                        const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
                        const pdfDocument = await loadingTask.promise;
                        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                            if (statements.find(st => st.page === pageNum)) continue;

                            const page = await pdfDocument.getPage(pageNum);
                            const textContent = await page.getTextContent();
                            const lines = textContent.items
                                .map(item => (item.str || '').trim())
                                .filter(Boolean);

                            const title = lines[0]?.slice(0, 160) || `Page ${pageNum}`;
                            const body = lines.join('\n').trim();

                            statements.push({
                                id: `${docId}-statement-${pageNum}`,
                                order: pageNum,
                                page: pageNum,
                                title,
                                body: body || '(Page vide)'
                            });
                        }
                        statements.sort((a, b) => a.page - b.page);
                    } catch (innerError) {
                        console.warn('[Statements] Unable to backfill pages:', innerError.message);
                    }
                }
            }
        }

        if ((!statements || statements.length === 0) && statementsResult?.text) {
            statements = buildStatementsFromText(docId, statementsResult.text);
        }

        const derivedTitle = req.files.visualPdfFile.name.replace(constants.FILE_EXTENSIONS.PDF, '');
        const title = courseName || derivedTitle;

        // Create and save JSON sidecar file
        const sidecarData = {
            id: docId,
            title: title,
            text: textResult.text, // Text from text PDF (for TTS)
            filename: visualPdfFilename, // Visual PDF filename (for display)
            textFilename: textPdfFilename, // Text PDF filename
            visualFilename: visualPdfFilename, // Visual PDF filename
            length: textResult.text.length,
            numPagesText: textResult.numpages || 1, // Number of pages in text PDF
            numPagesVisual: visualResult.numpages || 1, // Number of pages in visual PDF
            statementsFilename: statementsPdfFilename,
            statements,
            numPagesStatements: statementsResult?.numpages || 0,
            statementsCount: statements?.length || 0,
            isDualMode: true, // Always true now
            timestamp: new Date().toISOString(),
            courseName: title,
            courseDescription: courseDescription || null
        };

        await fileUtils.saveDocumentMetadata(sidecarData);

        res.json({
            text: textResult.text,
            docId: docId,
            filename: visualPdfFilename, // Visual PDF for display
            textFilename: textPdfFilename,
            visualFilename: visualPdfFilename,
            statementsFilename: statementsPdfFilename,
            isDualMode: true,
            numPagesText: sidecarData.numPagesText,
            numPagesVisual: sidecarData.numPagesVisual,
            numPagesStatements: sidecarData.numPagesStatements,
            statementsCount: sidecarData.statementsCount,
            title: sidecarData.title,
            courseName: sidecarData.courseName,
            courseDescription: sidecarData.courseDescription
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
 * Returns visual PDF by default (for display), or text PDF if requested
 * GET /api/documents/:docId/file?type=visual|text
 */
async function getDocumentFile(req, res) {
    try {
        // Document ID validation is handled by middleware (validateDocId)
        const { docId } = req.params;
        const { type = 'visual' } = req.query; // 'visual' or 'text', default to 'visual'

        // Get document metadata
        const metadata = await fileUtils.getDocumentMetadata(docId);
        if (!metadata) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        let pdfFilePath;
        let filename;

        // Support both new format (dual mode) and legacy format (backward compatibility)
        if (metadata.isDualMode && metadata.textFilename && metadata.visualFilename) {
            // New format: dual PDF mode
            if (type === 'text') {
                pdfFilePath = path.join(config.UPLOADS_DIR, metadata.textFilename);
                filename = metadata.textFilename;
            } else {
                pdfFilePath = path.join(config.UPLOADS_DIR, metadata.visualFilename);
                filename = metadata.visualFilename;
            }
        } else {
            // Legacy format: single PDF (backward compatibility for old documents)
            pdfFilePath = path.join(config.UPLOADS_DIR, `${docId}${constants.FILE_EXTENSIONS.PDF}`);
            filename = metadata.filename || `${docId}${constants.FILE_EXTENSIONS.PDF}`;
        }

        // Check if file exists (async)
        if (!(await fileUtils.fileExists(pdfFilePath))) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        // Set appropriate headers with CORS support and send file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        // Explicitly set CORS headers for file downloads
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

/**
 * Get page timings for a document
 * GET /api/documents/:docId/page-timings
 * Returns array of page numbers with cumulative time in seconds
 */
async function getPageTimings(req, res) {
    try {
        // Document ID validation is handled by middleware (validateDocId)
        const { docId } = req.params;

        // Get document metadata first to check if dual mode
        const metadata = await fileUtils.getDocumentMetadata(docId);
        if (!metadata) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        // Use VISUAL PDF ONLY for word counting and page timings
        // This ensures timings are based on what the user sees (presentation PDF)
        // In dual mode: visualFilename = "{docId}_visual.pdf" (for counting words)
        //              textFilename = "{docId}_text.pdf" (for TTS, NOT used here)
        // Support both new format (dual mode) and legacy format (backward compatibility)
        let visualPdfPath;
        
        if (metadata.isDualMode && metadata.textFilename && metadata.visualFilename) {
            // New format: dual PDF mode - use visual PDF ({docId}_visual.pdf) for counting
            visualPdfPath = path.join(config.UPLOADS_DIR, metadata.visualFilename);
            console.log(`[Page Timings] Using VISUAL PDF for word counting: ${metadata.visualFilename}`);
        } else {
            // Legacy format: single PDF (backward compatibility for old documents)
            visualPdfPath = path.join(config.UPLOADS_DIR, `${docId}${constants.FILE_EXTENSIONS.PDF}`);
        }

   
        // Check if files exist
        if (!(await fileUtils.fileExists(visualPdfPath))) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        // Parse VISUAL PDF and extract text page by page (NOT the text PDF)
        // This ensures word counts match what the user sees on screen
        const visualPdfBuffer = await fsPromises.readFile(visualPdfPath);
        
        // Extract full text first to check for "next slide" markers
        // Priority: "next slide" markers > PDF page extraction
        const visualPdfData = await pdfParse(visualPdfBuffer);
        const fullVisualText = visualPdfData.text || '';
        
        // Check if text contains "next slide" markers to divide pages/slides
        const nextSlideMarker = /next\s+slide/gi;
        const hasSlideMarkers = nextSlideMarker.test(fullVisualText);
        
        // Text to exclude from word count (e.g., "Titan Academy")
        const excludeFromCount = /titan\s+academy/gi;
        
        /**
         * Count words in text, excluding specified phrases
         * @param {string} text - Text to count words in
         * @returns {number} Word count
         */
        function countWordsExcluding(text) {
            if (!text || typeof text !== 'string') return 0;
            // Remove excluded phrases first
            let cleanedText = text.replace(excludeFromCount, ' ');
            // Split by whitespace and filter empty strings
            const words = cleanedText.trim().split(/\s+/).filter(word => word.length > 0);
            return words.length;
        }
        
        let pageWordCounts = [];
        let numPages = 1;
        
        if (hasSlideMarkers) {
            // Priority 1: Split text by "next slide" markers - each segment is a slide
            // This provides accurate slide division based on explicit markers
            const slideSegments = fullVisualText.split(nextSlideMarker);
            
            // Each segment represents content for one slide
            let currentPageNum = 1;
            slideSegments.forEach((segment) => {
                const cleanedSegment = segment.trim();
                
                if (cleanedSegment.length > 0) {
                    // Count words excluding "Titan Academy" and "next slide" marker
                    const wordCount = countWordsExcluding(cleanedSegment);
                    pageWordCounts.push({
                        page: currentPageNum,
                        wordCount: wordCount,
                        text: cleanedSegment
                    });
                    currentPageNum++;
                }
            });
            
            // Update numPages to match actual slide count
            numPages = pageWordCounts.length || 1;
            console.log(`[Page Timings] Found ${numPages} slides based on "next slide" markers`);
        } else {
            // Priority 2: No "next slide" markers - use PDF page extraction (pdfjs-dist or fallback)
            // Try to use pdfjs-dist for page-by-page extraction
            if (pdfjsLib) {
                try {
                    const loadingTask = pdfjsLib.getDocument({ data: visualPdfBuffer });
                    const pdfDocument = await loadingTask.promise;
                    numPages = pdfDocument.numPages;

                    // Extract text from each page
                    const pagePromises = [];
                    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                        pagePromises.push(
                            pdfDocument.getPage(pageNum).then(async (page) => {
                                const textContent = await page.getTextContent();
                                // Extract text from text items
                                const pageText = textContent.items
                                    .map(item => item.str)
                                    .join(' ')
                                    .trim();
                                
                                // Remove "next slide" if present (not counted in words)
                                let cleanedText = pageText.replace(nextSlideMarker, ' ').trim();
                                
                                // Count words excluding "Titan Academy"
                                const wordCount = countWordsExcluding(cleanedText);
                                
                                // Also remove "Titan Academy" from text for display
                                cleanedText = cleanedText.replace(excludeFromCount, ' ').trim();
                                
                                return {
                                    page: pageNum,
                                    wordCount: wordCount,
                                    text: cleanedText
                                };
                            })
                        );
                    }

                    pageWordCounts = await Promise.all(pagePromises);
                } catch (pdfjsError) {
                    console.warn('[Page Timings] PDF.js extraction failed, using pdf-parse fallback:', pdfjsError.message);
                    // Fallback continues below
                }
            }
            
            // Fallback: use estimated distribution based on PDF pages
            if (pageWordCounts.length === 0) {
                numPages = visualPdfData.numpages || 1;
                
                // Create page word counts (estimated distribution)
                // Note: We need to exclude "Titan Academy" from the word count
                // Split the full text by "Titan Academy" first to get accurate word counts
                const textWithoutExcluded = fullVisualText.replace(excludeFromCount, ' ').trim();
                const allWordsArray = textWithoutExcluded.split(/\s+/).filter(word => word.length > 0);
                const totalWordsExcluded = allWordsArray.length;
                const avgWordsPerPage = numPages > 0 ? Math.ceil(totalWordsExcluded / numPages) : 0;
                
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const startIndex = (pageNum - 1) * avgWordsPerPage;
                    const endIndex = pageNum === numPages ? totalWordsExcluded : pageNum * avgWordsPerPage;
                    const pageWords = allWordsArray.slice(startIndex, endIndex);
                    const pageText = pageWords.join(' ');
                    pageWordCounts.push({
                        page: pageNum,
                        wordCount: endIndex - startIndex,
                        text: pageText
                    });
                }
            }
        }

        // Calculate timings based on reading/speaking speed
        // Pages are in LANDSCAPE mode (more content per page than portrait)
        // Average reading speed: 150-200 words per minute (WPM)
        // Average speaking speed for TTS: ~150 words per minute
        // Using 150 WPM = 2.5 words per second
        // Note: Landscape pages typically have more words, but we count actual words per page
        // so the calculation automatically accounts for landscape layout
        const wordsPerMinute = 150;
        const wordsPerSecond = wordsPerMinute / 60; // ~2.5 words/sec

        // Generate page timings array (cumulative) based on actual word counts per page
        // Sort by page number to ensure correct order
        pageWordCounts.sort((a, b) => a.page - b.page);
        
        const pageTimings = [];
        let cumulativeTime = 0;

        for (const pageData of pageWordCounts) {
            const pageNum = pageData.page;
            const wordCount = pageData.wordCount;
            const pageText = pageData.text || '';
            
            if (pageNum === 1) {
                // First page starts at 0
                pageTimings.push({ 
                    page: 1, 
                    time: 0,  // Début de la page 1
                    wordCount: wordCount,
                    text: pageText
                });
                // Calculate time for first page
                const secondsForPage = wordCount / wordsPerSecond;
                cumulativeTime = secondsForPage; // Temps de fin de la page 1
            } else {
                // Le temps retourné est le DÉBUT de cette page (= fin de la page précédente)
                // On retourne cumulativeTime AVANT d'ajouter le temps de la page courante
                pageTimings.push({ 
                    page: pageNum, 
                    time: Math.round(cumulativeTime * 10) / 10, // Temps de début de cette page
                    wordCount: wordCount,
                    text: pageText
                });
                // Puis on ajoute le temps de cette page pour la suivante
                const secondsForPage = wordCount / wordsPerSecond;
                cumulativeTime += secondsForPage; // Temps de fin de cette page
            }
        }

        res.json(pageTimings);
    } catch (error) {
        console.error("[Page Timings Error]:", error);
        res.status(500).json({ 
            error: 'Failed to calculate page timings.',
            details: error.message 
        });
    }
}

/**
 * Delete a document and its related assets
 * DELETE /api/documents/:docId
 */
async function deleteDocument(req, res) {
    try {
        const { docId } = req.params;
        const deleted = await fileUtils.deleteDocumentAssets(docId);

        if (!deleted) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        res.json({
            message: 'Document deleted successfully',
            docId
        });
    } catch (error) {
        console.error("[Document Delete Error]:", error);
        res.status(500).json({
            error: 'Failed to delete document.',
            details: error.message
        });
    }
}

/**
 * Generate lip sync JSON using Rhubarb
 * POST /api/documents/:docId/lipsync
 */
async function generateLipSync(req, res) {
    try {
        const { docId } = req.params;
        const force = req.query?.force === 'true';

        const metadata = await fileUtils.getDocumentMetadata(docId);
        if (!metadata) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        const audioPath = await ensureDocumentAudio(docId);
        const lipSyncExists = await fileUtils.lipSyncFileExists(docId);

        if (lipSyncExists && !force) {
            const existingData = await fileUtils.readLipSyncFile(docId);
            return res.json({
                message: 'Lip sync already exists. Use ?force=true to regenerate.',
                docId,
                lipSyncFile: `/audios/${docId}.json`,
                mouthCues: existingData?.mouthCues?.length || 0,
                metadata: existingData?.metadata || null,
                cached: true
            });
        }

        const lipSyncPath = fileUtils.getLipSyncFilePath(docId);
        await lipSyncService.generateLipSync(audioPath, lipSyncPath);

        const lipSyncData = await fileUtils.readLipSyncFile(docId);

        res.json({
            message: 'Lip sync generated successfully.',
            docId,
            lipSyncFile: `/audios/${docId}.json`,
            mouthCues: lipSyncData?.mouthCues?.length || 0,
            metadata: lipSyncData?.metadata || null,
            cached: false
        });
    } catch (error) {
        console.error("[Lip Sync Error]:", error);
        res.status(500).json({
            error: 'Failed to generate lip sync.',
            details: error.message
        });
    }
}

/**
 * Get exercise statements for a document
 * GET /api/documents/:docId/statements
 */
async function getDocumentStatements(req, res) {
    try {
        const { docId } = req.params;
        const metadata = await fileUtils.getDocumentMetadata(docId);

        if (!metadata) {
            return res.status(404).json({ error: constants.ERROR_MESSAGES.DOC_NOT_FOUND });
        }

        const statements = Array.isArray(metadata.statements) ? metadata.statements : [];

        res.json({
            docId,
            hasStatements: statements.length > 0,
            statements
        });
    } catch (error) {
        console.error("[Document Statements Error]:", error);
        res.status(500).json({
            error: 'Failed to load statements.',
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
    getPageTimings,
    generateLipSync,
    deleteDocument,
    getDocumentStatements,
};

