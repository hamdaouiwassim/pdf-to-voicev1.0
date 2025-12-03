const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const fsPromises = require('fs').promises;
const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const localTTSService = require('../services/localTTSService');
const lipSyncService = require('../services/lipSyncService');
const pdfToWebpUtils = require('../utils/pdfToWebpUtils');
const config = require('../config/config');
const constants = require('../utils/constants');
const path = require('path');

// PDF.js for page-by-page text extraction
let pdfjsLib;
try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (err) {
    console.warn('[PDF.js] pdfjs-dist not installed, will use pdf-parse fallback');
    pdfjsLib = null;
}

function buildStatementsFromText(chapterId, rawText) {
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
                id: `${chapterId}-statement-${index + 1}`,
                order: index + 1,
                page: index + 1,
                title,
                body: cleaned
            };
        })
        .filter(Boolean);
}

async function extractStatementsByPage(chapterId, pdfBuffer) {
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
                id: `${chapterId}-statement-${pageNum}`,
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

async function ensureChapterAudio(chapterId) {
    const audioPath = fileUtils.getAudioFilePath(chapterId);
    if (await fileUtils.audioFileExists(chapterId)) {
        return audioPath;
    }

    const text = await fileUtils.getChapterText(chapterId);
    if (!text) {
        throw new Error('Chapter content not found for audio generation.');
    }

    const { pcmBuffer } = await geminiService.generateTTS(text, config.TTS_VOICE_DOCUMENT);
    const wavBuffer = audioUtils.pcmToWav(pcmBuffer);
    await fileUtils.saveAudioFile(chapterId, wavBuffer);
    return audioPath;
}

/**
 * Create a new chapter in a course
 * POST /api/courses/:courseId/chapters
 */
async function createChapter(req, res) {
    try {
        const { courseId } = req.params;
        
        // Validate course exists
        const course = await fileUtils.getCourseMetadata(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // File validation is handled by middleware
        const textPdfBuffer = req.files.textPdfFile.data;
        const visualPdfBuffer = req.files.visualPdfFile.data;
        const statementsPdfFile = req.files?.statementsPdfFile;
        const chapterName = typeof req.body?.chapterName === 'string' ? req.body.chapterName.trim() : '';
        const chapterDescription = typeof req.body?.chapterDescription === 'string' ? req.body.chapterDescription.trim() : '';

        // Generate unique ID for the chapter
        const chapterId = crypto.randomUUID();

        // Create chapter directory
        const chapterDir = path.join(config.UPLOADS_DIR, 'courses', courseId, chapterId);
        await fsPromises.mkdir(chapterDir, { recursive: true });

        // File paths
        const textPdfFilename = `${chapterId}_text${constants.FILE_EXTENSIONS.PDF}`;
        const visualPdfFilename = `${chapterId}_visual${constants.FILE_EXTENSIONS.PDF}`;
        const statementsPdfFilename = statementsPdfFile ? `${chapterId}_statements${constants.FILE_EXTENSIONS.PDF}` : null;
        
        const textPdfPath = path.join(chapterDir, textPdfFilename);
        const visualPdfPath = path.join(chapterDir, visualPdfFilename);
        const statementsPdfPath = statementsPdfFilename ? path.join(chapterDir, statementsPdfFilename) : null;

        // WebP output directory
        const webpDir = path.join(chapterDir, 'webp');

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

        // Extract statements if provided
        if (statementsPdfFile) {
            statements = await extractStatementsByPage(chapterId, statementsPdfFile.data);

            if (statements.length < (statementsResult?.numpages || 0)) {
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
                                id: `${chapterId}-statement-${pageNum}`,
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
            statements = buildStatementsFromText(chapterId, statementsResult.text);
        }

        // Convert visual PDF to WebP images (scale 2000, high quality)
        let webpImages = [];
        try {
            console.log(`[Chapter] Converting visual PDF to WebP for chapter ${chapterId}...`);
            webpImages = await pdfToWebpUtils.convertPdfToWebp(visualPdfPath, webpDir, 2000);
            console.log(`[Chapter] Converted ${webpImages.length} pages to WebP`);
        } catch (error) {
            console.warn(`[Chapter] Failed to convert PDF to WebP: ${error.message}`);
            // Continue even if WebP conversion fails
        }

        // Generate chapter name from visual PDF filename if not provided
        const derivedTitle = req.files.visualPdfFile.name.replace(constants.FILE_EXTENSIONS.PDF, '');
        const title = chapterName || derivedTitle;

        // Create chapter metadata
        const chapterData = {
            id: chapterId,
            courseId: courseId,
            chapterName: title,
            chapterDescription: chapterDescription || null,
            text: textResult.text,
            textFilename: textPdfFilename,
            visualFilename: visualPdfFilename,
            statementsFilename: statementsPdfFilename,
            length: textResult.text.length,
            numPagesText: textResult.numpages || 1,
            numPagesVisual: visualResult.numpages || 1,
            numPagesStatements: statementsResult?.numpages || 0,
            statementsCount: statements?.length || 0,
            statements: statements,
            webpImages: webpImages.map(img => path.relative(config.UPLOADS_DIR, img)), // Store relative paths
            timestamp: new Date().toISOString()
        };

        // Save chapter metadata
        await fileUtils.saveChapterMetadata(chapterData);

        // Update course with new chapter
        course.chapters.push({
            id: chapterId,
            chapterName: title,
            chapterDescription: chapterDescription || null,
            createdAt: chapterData.timestamp
        });
        course.updatedAt = new Date().toISOString();
        await fileUtils.saveCourseMetadata(course);

        res.json({
            chapterId: chapterId,
            courseId: courseId,
            chapterName: chapterData.chapterName,
            chapterDescription: chapterData.chapterDescription,
            textFilename: chapterData.textFilename,
            visualFilename: chapterData.visualFilename,
            statementsFilename: chapterData.statementsFilename,
            numPagesText: chapterData.numPagesText,
            numPagesVisual: chapterData.numPagesVisual,
            numPagesStatements: chapterData.numPagesStatements,
            statementsCount: chapterData.statementsCount,
            webpImages: chapterData.webpImages,
            createdAt: chapterData.timestamp
        });
    } catch (error) {
        console.error("[Chapter Create Error]:", error);
        res.status(500).json({
            error: 'Failed to create chapter.',
            details: error.message
        });
    }
}

/**
 * Get all chapters in a course
 * GET /api/courses/:courseId/chapters
 */
async function getChapters(req, res) {
    try {
        const { courseId } = req.params;
        const course = await fileUtils.getCourseMetadata(courseId);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Get full chapter details
        const chapters = await Promise.all(
            course.chapters.map(async (chapterRef) => {
                const chapter = await fileUtils.getChapterMetadata(courseId, chapterRef.id);
                return chapter ? {
                    id: chapter.id,
                    chapterName: chapter.chapterName,
                    chapterDescription: chapter.chapterDescription,
                    numPagesText: chapter.numPagesText,
                    numPagesVisual: chapter.numPagesVisual,
                    numPagesStatements: chapter.numPagesStatements,
                    statementsCount: chapter.statementsCount,
                    webpImages: chapter.webpImages || [],
                    webpConversionStatus: chapter.webpConversionStatus,
                    createdAt: chapter.timestamp
                } : null;
            })
        );

        res.json(chapters.filter(ch => ch !== null));
    } catch (error) {
        console.error("[Chapters List Error]:", error);
        res.status(500).json({
            error: 'Failed to list chapters.',
            details: error.message
        });
    }
}

/**
 * Get a chapter by ID
 * GET /api/courses/:courseId/chapters/:chapterId
 */
async function getChapter(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const chapter = await fileUtils.getChapterMetadata(courseId, chapterId);

        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        res.json(chapter);
    } catch (error) {
        console.error("[Chapter Get Error]:", error);
        res.status(500).json({
            error: 'Failed to get chapter.',
            details: error.message
        });
    }
}

/**
 * Get chapter file (PDF or WebP image)
 * GET /api/courses/:courseId/chapters/:chapterId/file?type=visual|text|webp&page=1
 */
async function getChapterFile(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const { type = 'visual', page } = req.query;

        const chapter = await fileUtils.getChapterMetadata(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const chapterDir = path.join(config.UPLOADS_DIR, 'courses', courseId, chapterId);

        if (type === 'webp' && page) {
            // Return WebP image for specific page
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                return res.status(400).json({ error: 'Invalid page number' });
            }

            const webpDir = path.join(chapterDir, 'webp');
            const webpFiles = await fsPromises.readdir(webpDir);
            const pageFile = webpFiles.find(f => {
                // Match both formats: page-01.webp or page01.webp
                const match = f.match(/(?:-|page)(\d+)\.webp$/);
                return match && parseInt(match[1]) === pageNum;
            });

            if (!pageFile) {
                return res.status(404).json({ error: 'WebP image not found for this page' });
            }

            const webpPath = path.join(webpDir, pageFile);
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.sendFile(path.resolve(webpPath));
        } else {
            // Return PDF file
            let pdfFilePath;
            let filename;

            if (type === 'text') {
                pdfFilePath = path.join(chapterDir, chapter.textFilename);
                filename = chapter.textFilename;
            } else {
                pdfFilePath = path.join(chapterDir, chapter.visualFilename);
                filename = chapter.visualFilename;
            }

            if (!(await fileUtils.fileExists(pdfFilePath))) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.sendFile(path.resolve(pdfFilePath));
        }
    } catch (error) {
        console.error("[Chapter File Error]:", error);
        res.status(500).json({
            error: 'Failed to retrieve chapter file.',
            details: error.message
        });
    }
}

/**
 * Summarize a chapter
 * GET /api/courses/:courseId/chapters/:chapterId/summary
 */
async function summarizeChapter(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const { language } = req.query;

        const chapter = await fileUtils.getChapterMetadata(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const summaryAudioId = `${chapterId}${constants.AUDIO_PREFIXES.SUMMARY}`;
        let wavBuffer = null;
        let summary = null;

        const summaryLanguage = language || 'fr';
        
        const hasCachedSummary = chapter.summary && chapter.summaryLanguage === summaryLanguage;
        const hasCachedAudio = await fileUtils.audioFileExists(summaryAudioId);

        if (hasCachedSummary && hasCachedAudio) {
            console.log(`[Summary] Serving cached summary and audio for chapter ID: ${chapterId}`);
            summary = chapter.summary;
            wavBuffer = await fileUtils.readAudioFile(summaryAudioId);
        } else {
            const text = chapter.text || await fileUtils.getChapterText(chapterId);
            
            if (!text) {
                return res.status(404).json({ error: 'Chapter content not found' });
            }

            console.log(`[Summary] Generating summary for chapter ID: ${chapterId}`);
            summary = await geminiService.generateSummary(text, summaryLanguage);

            chapter.summary = summary;
            chapter.summaryLanguage = summaryLanguage;
            chapter.summaryTimestamp = new Date().toISOString();
            await fileUtils.saveChapterMetadata(chapter);

            if (!hasCachedAudio) {
                console.log(`[Summary] Generating audio from summary for chapter ID: ${chapterId}`);
                try {
                    if (process.platform === 'win32') {
                        wavBuffer = await localTTSService.generateTTSLocal(summary, summaryLanguage === 'fr' ? 'fr-FR' : 'en-US');
                        console.log(`[Summary] Generated audio using Local TTS (Windows SAPI, ${summaryLanguage})`);
                    } else {
                        throw new Error('Local TTS not available on this platform');
                    }
                } catch (localTtsError) {
                    console.warn(`[Summary] Local TTS failed, trying Edge TTS:`, localTtsError.message);
                    try {
                        const edgeTTSService = require('../services/edgeTTSService');
                        wavBuffer = await edgeTTSService.generateTTSWithEdge(summary, summaryLanguage === 'fr' ? 'fr-FR' : 'en-US');
                        console.log(`[Summary] Generated audio using Edge TTS (${summaryLanguage})`);
                    } catch (edgeError) {
                        console.warn(`[Summary] Edge TTS failed, trying Gemini TTS:`, edgeError.message);
                        try {
                            const { pcmBuffer } = await geminiService.generateTTS(summary, config.TTS_VOICE_DOCUMENT);
                            wavBuffer = audioUtils.pcmToWav(pcmBuffer);
                            console.log(`[Summary] Generated audio using Gemini TTS`);
                        } catch (geminiError) {
                            throw new Error(`All TTS services failed. Local: ${localTtsError.message}, Edge: ${edgeError.message}, Gemini: ${geminiError.message}`);
                        }
                    }
                }
                await fileUtils.saveAudioFile(summaryAudioId, wavBuffer);
                console.log(`[Summary] Saved summary audio cache for chapter ID: ${chapterId}`);
            } else {
                wavBuffer = await fileUtils.readAudioFile(summaryAudioId);
            }
        }

        res.json({
            chapterId: chapterId,
            summary: summary,
            audioData: wavBuffer.toString('base64'),
            mimeType: 'audio/wav',
            originalLength: chapter.length || chapter.text?.length || 0,
            summaryLength: summary.length,
            type: 'summary',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Chapter Summary Error]:", error);
        res.status(500).json({
            error: 'Failed to generate summary and audio.',
            details: error.message
        });
    }
}

/**
 * Generate lip sync for a chapter
 * POST /api/courses/:courseId/chapters/:chapterId/lipsync
 */
async function generateChapterLipSync(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const force = req.query?.force === 'true';

        const chapter = await fileUtils.getChapterMetadata(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const audioPath = await ensureChapterAudio(chapterId);
        const lipSyncExists = await fileUtils.lipSyncFileExists(chapterId);

        if (lipSyncExists && !force) {
            const existingData = await fileUtils.readLipSyncFile(chapterId);
            return res.json({
                message: 'Lip sync already exists. Use ?force=true to regenerate.',
                chapterId,
                lipSyncFile: `/audios/${chapterId}.json`,
                mouthCues: existingData?.mouthCues?.length || 0,
                metadata: existingData?.metadata || null,
                cached: true
            });
        }

        const lipSyncPath = fileUtils.getLipSyncFilePath(chapterId);
        await lipSyncService.generateLipSync(audioPath, lipSyncPath);

        const lipSyncData = await fileUtils.readLipSyncFile(chapterId);

        res.json({
            message: 'Lip sync generated successfully.',
            chapterId,
            lipSyncFile: `/audios/${chapterId}.json`,
            mouthCues: lipSyncData?.mouthCues?.length || 0,
            metadata: lipSyncData?.metadata || null,
            cached: false
        });
    } catch (error) {
        console.error("[Chapter Lip Sync Error]:", error);
        res.status(500).json({
            error: 'Failed to generate lip sync.',
            details: error.message
        });
    }
}

/**
 * Get page timings for a chapter
 * GET /api/courses/:courseId/chapters/:chapterId/page-timings
 */
async function getChapterPageTimings(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const chapter = await fileUtils.getChapterMetadata(courseId, chapterId);

        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const chapterDir = path.join(config.UPLOADS_DIR, 'courses', courseId, chapterId);
        const visualPdfPath = path.join(chapterDir, chapter.visualFilename);

        if (!(await fileUtils.fileExists(visualPdfPath))) {
            return res.status(404).json({ error: 'Chapter PDF not found' });
        }

        const visualPdfBuffer = await fsPromises.readFile(visualPdfPath);
        const visualPdfData = await pdfParse(visualPdfBuffer);
        const fullVisualText = visualPdfData.text || '';

        const nextSlideMarker = /next\s+slide/gi;
        const hasSlideMarkers = nextSlideMarker.test(fullVisualText);
        const excludeFromCount = /titan\s+academy/gi;

        function countWordsExcluding(text) {
            if (!text || typeof text !== 'string') return 0;
            let cleanedText = text.replace(excludeFromCount, ' ');
            const words = cleanedText.trim().split(/\s+/).filter(word => word.length > 0);
            return words.length;
        }

        let pageWordCounts = [];
        let numPages = 1;

        if (hasSlideMarkers) {
            const slideSegments = fullVisualText.split(nextSlideMarker);
            let currentPageNum = 1;
            slideSegments.forEach((segment) => {
                const cleanedSegment = segment.trim();
                if (cleanedSegment.length > 0) {
                    const wordCount = countWordsExcluding(cleanedSegment);
                    pageWordCounts.push({
                        page: currentPageNum,
                        wordCount: wordCount,
                        text: cleanedSegment
                    });
                    currentPageNum++;
                }
            });
            numPages = pageWordCounts.length || 1;
        } else {
            if (pdfjsLib) {
                try {
                    const loadingTask = pdfjsLib.getDocument({ data: visualPdfBuffer });
                    const pdfDocument = await loadingTask.promise;
                    numPages = pdfDocument.numPages;

                    const pagePromises = [];
                    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                        pagePromises.push(
                            pdfDocument.getPage(pageNum).then(async (page) => {
                                const textContent = await page.getTextContent();
                                const pageText = textContent.items
                                    .map(item => item.str)
                                    .join(' ')
                                    .trim();

                                let cleanedText = pageText.replace(nextSlideMarker, ' ').trim();
                                const wordCount = countWordsExcluding(cleanedText);
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
                    console.warn('[Page Timings] PDF.js extraction failed, using fallback:', pdfjsError.message);
                }
            }

            if (pageWordCounts.length === 0) {
                numPages = visualPdfData.numpages || 1;
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

        const wordsPerMinute = 150;
        const wordsPerSecond = wordsPerMinute / 60;

        pageWordCounts.sort((a, b) => a.page - b.page);

        const pageTimings = [];
        let cumulativeTime = 0;

        for (const pageData of pageWordCounts) {
            const pageNum = pageData.page;
            const wordCount = pageData.wordCount;
            const pageText = pageData.text || '';

            if (pageNum === 1) {
                pageTimings.push({
                    page: 1,
                    time: 0,
                    wordCount: wordCount,
                    text: pageText
                });
                const secondsForPage = wordCount / wordsPerSecond;
                cumulativeTime = secondsForPage;
            } else {
                pageTimings.push({
                    page: pageNum,
                    time: Math.round(cumulativeTime * 10) / 10,
                    wordCount: wordCount,
                    text: pageText
                });
                const secondsForPage = wordCount / wordsPerSecond;
                cumulativeTime += secondsForPage;
            }
        }

        res.json(pageTimings);
    } catch (error) {
        console.error("[Chapter Page Timings Error]:", error);
        res.status(500).json({
            error: 'Failed to calculate page timings.',
            details: error.message
        });
    }
}

/**
 * Get chapter statements
 * GET /api/courses/:courseId/chapters/:chapterId/statements
 */
async function getChapterStatements(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const chapter = await fileUtils.getChapterMetadata(courseId, chapterId);

        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const statements = Array.isArray(chapter.statements) ? chapter.statements : [];

        res.json({
            chapterId,
            hasStatements: statements.length > 0,
            statements
        });
    } catch (error) {
        console.error("[Chapter Statements Error]:", error);
        res.status(500).json({
            error: 'Failed to load statements.',
            details: error.message
        });
    }
}

/**
 * Delete a chapter
 * DELETE /api/courses/:courseId/chapters/:chapterId
 */
async function deleteChapter(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const deleted = await fileUtils.deleteChapterAssets(courseId, chapterId);

        if (!deleted) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        res.json({
            message: 'Chapter deleted successfully',
            chapterId
        });
    } catch (error) {
        console.error("[Chapter Delete Error]:", error);
        res.status(500).json({
            error: 'Failed to delete chapter.',
            details: error.message
        });
    }
}

module.exports = {
    createChapter,
    getChapters,
    getChapter,
    getChapterFile,
    summarizeChapter,
    generateChapterLipSync,
    getChapterPageTimings,
    getChapterStatements,
    deleteChapter
};

