const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const fsPromises = require('fs').promises;
const fileUtils = require('../utils/fileUtils');
const dbUtils = require('../utils/dbUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
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

async function ensureChapterAudio(chapterId, courseId = null) {
    // Get chapter from database to get text content and courseId
    const db = require('../config/database');
    const chapters = await db.query(
        'SELECT text_content, course_id FROM chapters WHERE id = ? LIMIT 1',
        [chapterId]
    );

    if (chapters.length === 0) {
        throw new Error('Chapter not found in database.');
    }

    const chapterCourseId = chapters[0].course_id || courseId;
    const audioPath = chapterCourseId
        ? fileUtils.getChapterAudioFilePath(chapterId, chapterCourseId, 'main')
        : fileUtils.getAudioFilePath(chapterId);

    if (chapterCourseId) {
        if (await fileUtils.fileExists(fileUtils.getChapterAudioFilePath(chapterId, chapterCourseId, 'main'))) {
            return audioPath;
        }
    } else {
        if (await fileUtils.audioFileExists(chapterId)) {
            return audioPath;
        }
    }

    const text = chapters[0].text_content;
    if (!text) {
        throw new Error('Chapter content not found for audio generation.');
    }

    const { pcmBuffer } = await geminiService.generateTTS(text, config.TTS_VOICE_DOCUMENT);
    const wavBuffer = audioUtils.pcmToWav(pcmBuffer);
    if (chapterCourseId) {
        await fileUtils.saveChapterAudio(chapterId, chapterCourseId, 'main', wavBuffer);
    } else {
        await fileUtils.saveAudioFile(chapterId, wavBuffer);
    }
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
        const course = await dbUtils.getCourseById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // File validation is handled by middleware
        const videoLink = typeof req.body?.video_link === 'string' ? req.body.video_link.trim() : null;
        const hasVideoLink = videoLink && videoLink.length > 0;

        const textPdfFile = req.files?.textPdfFile;
        const visualPdfFile = req.files?.visualPdfFile;
        const statementsPdfFile = req.files?.statementsPdfFile;
        const chapterName = typeof req.body?.chapterName === 'string' ? req.body.chapterName.trim() : '';
        const chapterDescription = typeof req.body?.chapterDescription === 'string' ? req.body.chapterDescription.trim() : '';

        // Generate unique ID for the chapter
        const chapterId = crypto.randomUUID();

        // Create chapter directory (using new structure)
        const chapterDir = fileUtils.getChapterUploadsDir(courseId, chapterId);
        await fsPromises.mkdir(chapterDir, { recursive: true });

        // Initialize variables for PDF processing
        let textResult = null;
        let visualResult = null;
        let statementsResult = null;
        let statements = [];
        let textPdfFilename = null;
        let visualPdfFilename = null;
        let statementsPdfFilename = null;
        let webpImages = [];

        // Always process text PDF (needed for TTS and summary, even with video)
        if (textPdfFile) {
            const textPdfBuffer = textPdfFile.data;
            textPdfFilename = `${chapterId}_text${constants.FILE_EXTENSIONS.PDF}`;
            const textPdfPath = path.join(chapterDir, textPdfFilename);

            // Parse and save text PDF
            textResult = await pdfParse(textPdfBuffer);
            await fsPromises.writeFile(textPdfPath, textPdfBuffer);
        }

        // Process visual PDF and statements only if video_link is not provided
        if (!hasVideoLink) {
            if (!visualPdfFile) {
                return res.status(400).json({
                    error: 'Visual PDF file is required when video_link is not provided'
                });
            }

            const visualPdfBuffer = visualPdfFile.data;

            // File paths
            visualPdfFilename = `${chapterId}_visual${constants.FILE_EXTENSIONS.PDF}`;
            statementsPdfFilename = statementsPdfFile ? `${chapterId}_statements${constants.FILE_EXTENSIONS.PDF}` : null;

            const visualPdfPath = path.join(chapterDir, visualPdfFilename);
            const statementsPdfPath = statementsPdfFilename ? path.join(chapterDir, statementsPdfFilename) : null;

            // WebP output directory
            const webpDir = path.join(chapterDir, 'webp');

            // Parse visual PDF
            const visualParsePromise = pdfParse(visualPdfBuffer);
            const writePromises = [
                fsPromises.writeFile(visualPdfPath, visualPdfBuffer)
            ];

            let statementsParsePromise = null;
            if (statementsPdfFile) {
                statementsParsePromise = pdfParse(statementsPdfFile.data);
                writePromises.push(fsPromises.writeFile(statementsPdfPath, statementsPdfFile.data));
            }

            const parsePromises = [visualParsePromise];
            if (statementsParsePromise) {
                parsePromises.push(statementsParsePromise);
            }

            const parseResults = await Promise.all(parsePromises);
            await Promise.all(writePromises);

            visualResult = parseResults[0];
            statementsResult = statementsParsePromise ? parseResults[1] : null;

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
            try {
                console.log(`[Chapter] Converting visual PDF to WebP for chapter ${chapterId}...`);
                webpImages = await pdfToWebpUtils.convertPdfToWebp(visualPdfPath, webpDir, 2000);
                console.log(`[Chapter] Converted ${webpImages.length} pages to WebP`);
            } catch (error) {
                console.warn(`[Chapter] Failed to convert PDF to WebP: ${error.message}`);
                // Continue even if WebP conversion fails
            }
        }

        // Generate chapter name
        let title = chapterName;
        if (!title && !hasVideoLink && visualPdfFile) {
            title = visualPdfFile.name.replace(constants.FILE_EXTENSIONS.PDF, '');
        }
        if (!title) {
            title = `Chapter ${chapterId.substring(0, 8)}`;
        }

        // Create chapter in database
        const chapterData = {
            id: chapterId,
            courseId: courseId,
            chapterName: title,
            chapterDescription: chapterDescription || null,
            videoLink: videoLink || null,
            textContent: textResult?.text || null,
            textFilename: textPdfFilename,
            visualFilename: visualPdfFilename,
            statementsFilename: statementsPdfFilename,
            textLength: textResult?.text?.length || 0,
            numPagesText: textResult?.numpages || 0,
            numPagesVisual: visualResult?.numpages || 0,
            numPagesStatements: statementsResult?.numpages || 0,
            statementsCount: statements?.length || 0,
            statements: statements
        };

        // Save chapter to database
        const chapter = await dbUtils.createChapter(chapterData);

        // Store WebP images in database
        for (let i = 0; i < webpImages.length; i++) {
            const imgPath = webpImages[i];
            // Calculate relative path from course uploads directory
            const courseUploadsDir = fileUtils.getCourseUploadsDir(courseId);
            const relativePath = path.relative(courseUploadsDir, imgPath);
            await dbUtils.addChapterImage(chapterId, {
                imagePath: relativePath,
                pageNumber: i + 1,
                imageType: 'webp'
            });
        }

        // Generate page-based TTS audio in background (non-blocking)
        // This ensures perfect synchronization between audio and slides
        if (textResult && textResult.text) {
            generatePageTTSForChapter(chapterId, textPdfFilename, courseId)
                .then(() => {
                    console.log(`[Chapter] Successfully generated page TTS for chapter ${chapterId}`);
                })
                .catch((error) => {
                    console.error(`[Chapter] Failed to generate page TTS for chapter ${chapterId}:`, error.message);
                    // Don't fail the chapter creation if TTS generation fails
                });
        }

        res.json({
            chapterId: chapter.id,
            courseId: chapter.courseId,
            chapterName: chapter.chapterName,
            chapterDescription: chapter.chapterDescription,
            videoLink: chapter.videoLink,
            textFilename: chapter.textFilename,
            visualFilename: chapter.visualFilename,
            statementsFilename: chapter.statementsFilename,
            numPagesText: chapter.numPagesText,
            numPagesVisual: chapter.numPagesVisual,
            numPagesStatements: chapter.numPagesStatements,
            statementsCount: chapter.statementsCount,
            webpImages: chapter.webpImages,
            createdAt: chapter.createdAt,
            pageTTSGenerating: true // Indicate that TTS generation is in progress
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

        // Verify course exists
        const course = await dbUtils.getCourseById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Get all chapters from database
        const chapters = await dbUtils.getChaptersByCourseId(courseId);

        // Check TTS and lip sync status for each chapter
        const chaptersWithStatus = await Promise.all(chapters.map(async (chapter) => {
            const hasTTS = await fileUtils.fileExists(fileUtils.getChapterAudioFilePath(chapter.id, courseId, 'main'));
            const hasLipSync = await fileUtils.lipSyncFileExists(chapter.id, courseId, 'chapter');
            
            // Check if page audio exists (at least one page)
            let hasPageAudio = false;
            if (chapter.numPagesText > 0) {
                hasPageAudio = await fileUtils.pageAudioFileExists(chapter.id, 1, courseId);
            }

            return {
                ...chapter,
                hasTTS,
                hasLipSync,
                hasPageAudio
            };
        }));

        res.json(chaptersWithStatus);
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
        const chapter = await dbUtils.getChapterById(courseId, chapterId);

        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Check if TTS and lip sync exist
        const hasTTS = await fileUtils.fileExists(fileUtils.getChapterAudioFilePath(chapterId, courseId, 'main'));
        const hasLipSync = await fileUtils.lipSyncFileExists(chapterId, courseId, 'chapter');
        
        // Check if page audio exists (at least one page)
        let hasPageAudio = false;
        if (chapter.numPagesText > 0) {
            hasPageAudio = await fileUtils.pageAudioFileExists(chapterId, 1, courseId);
        }

        res.json({
            ...chapter,
            hasTTS,
            hasLipSync,
            hasPageAudio
        });
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
 * GET /api/courses/:courseId/chapters/:chapterId/file?type=visual|text|statements|webp&page=1
 */
async function getChapterFile(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const { type = 'visual', page } = req.query;

        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // If chapter has video_link but no PDF files, return error
        if (chapter.videoLink && !chapter.visualFilename && !chapter.textFilename) {
            return res.status(400).json({
                error: 'This chapter uses a video link and does not have PDF files. Use the video_link field instead.'
            });
        }

        // Use new structure
        const chapterDir = fileUtils.getChapterUploadsDir(courseId, chapterId);

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
                if (!chapter.textFilename) {
                    return res.status(404).json({ error: 'Text PDF file not available for this chapter' });
                }
                pdfFilePath = path.join(chapterDir, chapter.textFilename);
                filename = chapter.textFilename;
            } else if (type === 'statements') {
                if (!chapter.statementsFilename) {
                    return res.status(404).json({ error: 'Statements PDF file not available for this chapter' });
                }
                pdfFilePath = path.join(chapterDir, chapter.statementsFilename);
                filename = chapter.statementsFilename;
            } else {
                // Default to visual PDF
                if (!chapter.visualFilename) {
                    return res.status(404).json({ error: 'Visual PDF file not available for this chapter' });
                }
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

        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Allow video chapters to use their text PDF for summary/TTS; only block if no text content at all
        if (!chapter.textContent) {
            return res.status(404).json({ error: 'Chapter content not found' });
        }

        let wavBuffer = null;
        let summary = null;

        const summaryLanguage = language || 'fr';

        const hasCachedSummary = chapter.summary && chapter.summaryLanguage === summaryLanguage;
        const hasCachedAudio = await fileUtils.fileExists(fileUtils.getChapterAudioFilePath(chapterId, courseId, 'summary'));

        if (hasCachedSummary && hasCachedAudio) {
            console.log(`[Summary] Serving cached summary and audio for chapter ID: ${chapterId}`);
            summary = chapter.summary;
            wavBuffer = await fileUtils.readChapterAudio(chapterId, courseId, 'summary');
        } else {
            const text = chapter.textContent || null;

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

                // Use only Gemini TTS
                console.log(`[Summary] Generating audio using Gemini TTS...`);
                const { pcmBuffer } = await geminiService.generateTTS(summary, config.TTS_VOICE_DOCUMENT);
                wavBuffer = audioUtils.pcmToWav(pcmBuffer);
                console.log(`[Summary] Generated audio using Gemini TTS`);

                await fileUtils.saveChapterAudio(chapterId, courseId, 'summary', wavBuffer);
                console.log(`[Summary] Saved summary audio cache for chapter ID: ${chapterId}`);
            } else {
                wavBuffer = await fileUtils.readChapterAudio(chapterId, courseId, 'summary');
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

        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const audioPath = await ensureChapterAudio(chapterId, courseId);
        const lipSyncExists = await fileUtils.lipSyncFileExists(chapterId, courseId, 'chapter');

        if (lipSyncExists && !force) {
            const existingData = await fileUtils.readLipSyncFile(chapterId, courseId, 'chapter');
            return res.json({
                message: 'Lip sync already exists. Use ?force=true to regenerate.',
                chapterId,
                lipSyncFile: courseId ? `/api/courses/${courseId}/chapters/${chapterId}/lip-sync` : `/audios/${chapterId}.json`,
                mouthCues: existingData?.mouthCues?.length || 0,
                metadata: existingData?.metadata || null,
                cached: true
            });
        }

        // Generate new lip sync (using new structure)
        const lipSyncPath = fileUtils.getLipSyncFilePath(chapterId, courseId, 'chapter');
        const lipSyncDir = path.dirname(lipSyncPath);
        await fsPromises.mkdir(lipSyncDir, { recursive: true });
        
        await lipSyncService.generateLipSync(audioPath, lipSyncPath);

        const lipSyncData = await fileUtils.readLipSyncFile(chapterId, courseId, 'chapter');

        res.json({
            message: 'Lip sync generated successfully.',
            chapterId,
            lipSyncFile: courseId ? `/api/courses/${courseId}/chapters/${chapterId}/lip-sync` : `/audios/${chapterId}.json`,
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
 * Serve lip sync JSON for a chapter
 * GET /api/courses/:courseId/chapters/:chapterId/lip-sync
 */
async function getChapterLipSync(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const data = await fileUtils.readLipSyncFile(chapterId, courseId, 'chapter');
        if (!data) {
            return res.status(404).json({ error: 'Lip sync not found' });
        }
        res.setHeader('Content-Type', 'application/json');
        res.json(data);
    } catch (error) {
        console.error('[Chapter Lip Sync GET Error]:', error);
        res.status(500).json({
            error: 'Failed to retrieve lip sync.',
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
        const chapter = await dbUtils.getChapterById(courseId, chapterId);

        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Use new structure
        const chapterDir = fileUtils.getChapterUploadsDir(courseId, chapterId);
        const textPdfPath = path.join(chapterDir, chapter.textFilename);

        if (!(await fileUtils.fileExists(textPdfPath))) {
            return res.status(404).json({ error: 'Chapter text PDF not found' });
        }

        const pdfBuffer = await fsPromises.readFile(textPdfPath);

        // Try to parse the PDF - catch invalid PDF structure errors
        let pdfData, fullPdfText;
        try {
            pdfData = await pdfParse(pdfBuffer);
            fullPdfText = pdfData.text || '';
            console.log(`[Page Timings] Using text PDF: ${chapter.textFilename}`);
        } catch (pdfError) {
            console.error(`[Page Timings] PDF parsing error for ${chapter.textFilename}:`, pdfError.message);
            return res.status(400).json({
                error: 'Invalid PDF structure',
                details: `The text PDF file is corrupted or not a valid PDF format. Please re-upload the chapter with a valid text PDF.`,
                filename: chapter.textFilename
            });
        }

        const nextSlideMarker = /next\s+slide/gi;
        const hasSlideMarkers = nextSlideMarker.test(fullPdfText);
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
            const slideSegments = fullPdfText.split(nextSlideMarker);
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
                    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
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
                numPages = pdfData.numpages || 1;
                const textWithoutExcluded = fullPdfText.replace(excludeFromCount, ' ').trim();
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

            // Try to get actual audio duration if page audio exists
            let pageDuration = null;
            let audioPath = null;
            
            try {
                if (await fileUtils.pageAudioFileExists(chapterId, pageNum, courseId)) {
                    const audioBuffer = await fileUtils.readPageAudioFile(chapterId, pageNum, courseId);
                    pageDuration = await fileUtils.getAudioDuration(audioBuffer);
                    audioPath = fileUtils.getPageAudioFilePath(chapterId, pageNum, courseId);
                    console.log(`[Page Timings] Found audio for page ${pageNum}, duration: ${pageDuration}s`);
                }
            } catch (error) {
                console.warn(`[Page Timings] Could not read audio for page ${pageNum}:`, error.message);
            }

            // Use actual duration if available, otherwise calculate from word count
            const secondsForPage = pageDuration !== null ? pageDuration : (wordCount / wordsPerSecond);

            if (pageNum === 1) {
                pageTimings.push({
                    page: 1,
                    time: 0,
                    wordCount: wordCount,
                    text: pageText,
                    duration: pageDuration !== null ? pageDuration : Math.round(secondsForPage * 10) / 10,
                    audioPath: audioPath,
                    estimated: pageDuration === null
                });
                cumulativeTime = secondsForPage;
            } else {
                pageTimings.push({
                    page: pageNum,
                    time: Math.round(cumulativeTime * 10) / 10,
                    wordCount: wordCount,
                    text: pageText,
                    duration: pageDuration !== null ? pageDuration : Math.round(secondsForPage * 10) / 10,
                    audioPath: audioPath,
                    estimated: pageDuration === null
                });
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
 * Generate TTS audio for all pages in a chapter (background process)
 * Uses the same extraction logic as page timings to ensure perfect synchronization
 * @param {string} chapterId - Chapter ID
 * @param {string} textPdfFilename - Text PDF filename
 * @param {string} courseId - Course ID
 */
async function generatePageTTSForChapter(chapterId, textPdfFilename, courseId) {
    try {
        console.log(`[Chapter] Starting page TTS generation for chapter ${chapterId}...`);
        
        const pageTTSService = require('../services/pageTTSService');
        // Use new structure
        const chapterDir = fileUtils.getChapterUploadsDir(courseId, chapterId);
        const textPdfPath = path.join(chapterDir, textPdfFilename);

        if (!(await fileUtils.fileExists(textPdfPath))) {
            throw new Error(`Text PDF not found: ${textPdfPath}`);
        }

        // Read and parse PDF
        const pdfBuffer = await fsPromises.readFile(textPdfPath);
        let pdfData, fullPdfText;
        try {
            pdfData = await pdfParse(pdfBuffer);
            fullPdfText = pdfData.text || '';
        } catch (pdfError) {
            throw new Error(`PDF parsing error: ${pdfError.message}`);
        }

        // Use same extraction logic as page timings
        const nextSlideMarker = /next\s+slide/gi;
        const hasSlideMarkers = nextSlideMarker.test(fullPdfText);
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
            // Split by "next slide" markers
            const slideSegments = fullPdfText.split(nextSlideMarker);
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
            // Use PDF.js for page-by-page extraction
            if (pdfjsLib) {
                try {
                    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
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
                    console.warn('[Page TTS] PDF.js extraction failed, using fallback:', pdfjsError.message);
                    // Fallback continues below
                }
            }

            // Fallback: use estimated distribution
            if (pageWordCounts.length === 0) {
                numPages = pdfData.numpages || 1;
                const textWithoutExcluded = fullPdfText.replace(excludeFromCount, ' ').trim();
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

        // Sort by page number
        pageWordCounts.sort((a, b) => a.page - b.page);

        // Generate TTS for all pages
        const results = await pageTTSService.generateAllPagesTTS(pageWordCounts, chapterId, 'fr-FR', 3, courseId);
        
        const successCount = results.filter(r => r.success).length;
        console.log(`[Chapter] Generated TTS for ${successCount}/${pageWordCounts.length} pages in chapter ${chapterId}`);
        
        return results;
    } catch (error) {
        console.error(`[Chapter] Error generating page TTS for chapter ${chapterId}:`, error);
        throw error;
    }
}

/**
 * Generate or regenerate TTS audio for all pages in a chapter
 * POST /api/courses/:courseId/chapters/:chapterId/generate-page-audio
 */
async function generateChapterPageAudio(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        
        // Validate chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        if (!chapter.textFilename) {
            return res.status(400).json({ 
                error: 'Chapter text PDF not found',
                details: 'Cannot generate page audio without text PDF'
            });
        }

        // Generate TTS for all pages
        console.log(`[Chapter] Manual TTS generation requested for chapter ${chapterId}`);
        
        // Run in background but return immediately
        generatePageTTSForChapter(chapterId, chapter.textFilename, courseId)
            .then((results) => {
                const successCount = results.filter(r => r.success).length;
                console.log(`[Chapter] Completed TTS generation for chapter ${chapterId}: ${successCount}/${results.length} pages`);
            })
            .catch((error) => {
                console.error(`[Chapter] TTS generation failed for chapter ${chapterId}:`, error.message);
            });

        res.json({
            message: 'Page TTS generation started',
            chapterId: chapterId,
            status: 'processing'
        });
    } catch (error) {
        console.error("[Chapter Page Audio Generation Error]:", error);
        res.status(500).json({
            error: 'Failed to start page audio generation.',
            details: error.message
        });
    }
}

/**
 * Regenerate TTS audio for a chapter (delete old and regenerate)
 * POST /api/courses/:courseId/chapters/:chapterId/regenerate-tts
 */
async function regenerateChapterTTS(req, res) {
    try {
        const { courseId, chapterId } = req.params;

        // Validate chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        if (!chapter.textFilename) {
            return res.status(400).json({ 
                error: 'Chapter text PDF not found',
                details: 'Cannot regenerate TTS without text PDF'
            });
        }

        console.log(`[Chapter] Regenerating TTS for chapter ${chapterId}...`);

        // Delete old audio files
        const deleteResult = await fileUtils.deleteChapterAudioFiles(chapterId, courseId);
        console.log(`[Chapter] Deleted audio files: ${deleteResult.deleted.join(', ')}`);
        if (deleteResult.errors.length > 0) {
            console.warn(`[Chapter] Errors deleting some files: ${deleteResult.errors.join(', ')}`);
        }

        // Regenerate page TTS (wait for completion, not in background)
        console.log(`[Chapter] Starting TTS generation for all pages...`);
        const results = await generatePageTTSForChapter(chapterId, chapter.textFilename, courseId);
        
        const successCount = results.filter(r => r.success).length;
        const totalPages = results.length;
        const failedPages = results.filter(r => !r.success);
        
        console.log(`[Chapter] Completed TTS regeneration for chapter ${chapterId}: ${successCount}/${totalPages} pages`);

        if (failedPages.length > 0) {
            console.warn(`[Chapter] Failed pages: ${failedPages.map(r => r.page).join(', ')}`);
        }

        res.json({
            message: 'TTS regeneration completed',
            chapterId: chapterId,
            status: 'completed',
            deletedFiles: deleteResult.deleted,
            errors: deleteResult.errors,
            results: {
                totalPages: totalPages,
                successCount: successCount,
                failedCount: failedPages.length,
                failedPages: failedPages.map(r => ({ page: r.page, error: r.error }))
            }
        });
    } catch (error) {
        console.error("[Chapter TTS Regeneration Error]:", error);
        res.status(500).json({
            error: 'Failed to regenerate TTS.',
            details: error.message
        });
    }
}

/**
 * Regenerate lip sync for a chapter (delete old and regenerate)
 * POST /api/courses/:courseId/chapters/:chapterId/regenerate-lipsync
 */
async function regenerateChapterLipSync(req, res) {
    try {
        const { courseId, chapterId } = req.params;

        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        console.log(`[Chapter] Regenerating lip sync for chapter ${chapterId}...`);

        // Delete old lip sync file
        const deleteResult = await fileUtils.deleteChapterLipSyncFile(chapterId, courseId);
        if (deleteResult.error) {
            console.warn(`[Chapter] Error deleting lip sync: ${deleteResult.error}`);
        } else if (deleteResult.deleted) {
            console.log(`[Chapter] Deleted old lip sync file`);
        }

        // Ensure audio exists before generating lip sync
        const audioPath = await ensureChapterAudio(chapterId, courseId);

        // Generate new lip sync (using new structure)
        const lipSyncPath = fileUtils.getLipSyncFilePath(chapterId, courseId, 'chapter');
        const lipSyncDir = path.dirname(lipSyncPath);
        await fsPromises.mkdir(lipSyncDir, { recursive: true });
        
        const lipSyncService = require('../services/lipSyncService');
        await lipSyncService.generateLipSync(audioPath, lipSyncPath);

        const lipSyncData = await fileUtils.readLipSyncFile(chapterId, courseId, 'chapter');

        res.json({
            message: 'Lip sync regenerated successfully.',
            chapterId,
            lipSyncFile: courseId ? `/api/courses/${courseId}/chapters/${chapterId}/lip-sync` : `/audios/${chapterId}.json`,
            mouthCues: lipSyncData?.mouthCues?.length || 0,
            metadata: lipSyncData?.metadata || null,
            deleted: deleteResult.deleted
        });
    } catch (error) {
        console.error("[Chapter Lip Sync Regeneration Error]:", error);
        res.status(500).json({
            error: 'Failed to regenerate lip sync.',
            details: error.message
        });
    }
}

/**
 * Get audio file for a specific page
 * GET /api/courses/:courseId/chapters/:chapterId/audio/:pageNumber
 */
async function getChapterPageAudio(req, res) {
    try {
        const { courseId, chapterId, pageNumber } = req.params;
        
        // Validate chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Validate page number
        const pageNum = parseInt(pageNumber, 10);
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ error: 'Invalid page number' });
        }

        // Check if page audio exists
        const fileUtils = require('../utils/fileUtils');
        if (!(await fileUtils.pageAudioFileExists(chapterId, pageNum, courseId))) {
            return res.status(404).json({ 
                error: 'Page audio not found',
                details: `Audio for page ${pageNum} has not been generated yet. Please generate TTS for this chapter first.`
            });
        }

        // Read and return audio file
        const audioBuffer = await fileUtils.readPageAudioFile(chapterId, pageNum, courseId);
        const duration = await fileUtils.getAudioDuration(audioBuffer);

        // Determine MIME type (always WAV with Gemini TTS)
        const mimeType = 'audio/wav';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('X-Audio-Duration', duration.toString());
        res.send(audioBuffer);
    } catch (error) {
        console.error("[Chapter Page Audio Error]:", error);
        res.status(500).json({
            error: 'Failed to retrieve page audio.',
            details: error.message
        });
    }
}

/**
 * Get lip sync JSON for a specific page
 * GET /api/courses/:courseId/chapters/:chapterId/lip-sync/:pageNumber
 */
async function getChapterPageLipSync(req, res) {
    try {
        const { courseId, chapterId, pageNumber } = req.params;

        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const pageNum = parseInt(pageNumber, 10);
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ error: 'Invalid page number' });
        }

        if (!(await fileUtils.pageLipSyncFileExists(chapterId, pageNum, courseId))) {
            return res.status(404).json({
                error: 'Page lip sync not found',
                details: `Lip sync for page ${pageNum} has not been generated yet.`
            });
        }

        const data = await fileUtils.readPageLipSyncFile(chapterId, pageNum, courseId);
        res.setHeader('Content-Type', 'application/json');
        res.json(data);
    } catch (error) {
        console.error("[Chapter Page Lip Sync Error]:", error);
        res.status(500).json({
            error: 'Failed to retrieve page lip sync.',
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
        const chapter = await dbUtils.getChapterById(courseId, chapterId);

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
 * Update a chapter
 * PUT /api/courses/:courseId/chapters/:chapterId
 * Supports updating text fields and PDF files
 */
async function updateChapter(req, res) {
    try {
        const { courseId, chapterId } = req.params;

        // Validate course exists
        const course = await dbUtils.getCourseById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Validate chapter exists
        const existingChapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!existingChapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Get update fields from request body
        const chapterName = typeof req.body?.chapterName === 'string' ? req.body.chapterName.trim() : undefined;
        const chapterDescription = typeof req.body?.chapterDescription === 'string' ? req.body.chapterDescription.trim() : undefined;
        const videoLink = typeof req.body?.videoLink === 'string' ? req.body.videoLink.trim() : undefined;

        // Get PDF files if provided
        const textPdfFile = req.files?.textPdfFile;
        const visualPdfFile = req.files?.visualPdfFile;
        const statementsPdfFile = req.files?.statementsPdfFile;

        // Validate chapter name if provided
        if (chapterName !== undefined) {
            if (chapterName.length === 0) {
                return res.status(400).json({ error: 'Chapter name cannot be empty' });
            }
            if (chapterName.length > 150) {
                return res.status(400).json({ error: 'Chapter name must be less than 150 characters' });
            }
        }

        // Validate video link if provided
        if (videoLink !== undefined && videoLink.length > 0) {
            try {
                const url = new URL(videoLink);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    return res.status(400).json({
                        error: 'videoLink must be a valid HTTP or HTTPS URL'
                    });
                }
            } catch (urlError) {
                return res.status(400).json({
                    error: 'videoLink must be a valid URL'
                });
            }
        }

        // Validate PDF files if provided
        if (textPdfFile && !config.ALLOWED_MIME_TYPES.includes(textPdfFile.mimetype)) {
            return res.status(400).json({ error: 'Text PDF file must be application/pdf' });
        }
        if (visualPdfFile && !config.ALLOWED_MIME_TYPES.includes(visualPdfFile.mimetype)) {
            return res.status(400).json({ error: 'Visual PDF file must be application/pdf' });
        }
        if (statementsPdfFile && !config.ALLOWED_MIME_TYPES.includes(statementsPdfFile.mimetype)) {
            return res.status(400).json({ error: 'Statements PDF file must be application/pdf' });
        }

        // Use new structure
        const chapterDir = fileUtils.getChapterUploadsDir(courseId, chapterId);
        await fsPromises.mkdir(chapterDir, { recursive: true });

        // Process PDF files if provided
        let textResult = null;
        let visualResult = null;
        let statementsResult = null;
        let statements = [];
        let textPdfFilename = existingChapter.textFilename;
        let visualPdfFilename = existingChapter.visualFilename;
        let statementsPdfFilename = existingChapter.statementsFilename;
        let webpImages = [];

        // Process text PDF if provided
        if (textPdfFile) {
            // Delete old text PDF if exists
            if (existingChapter.textFilename) {
                const oldTextPath = path.join(chapterDir, existingChapter.textFilename);
                try {
                    await fsPromises.unlink(oldTextPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`[Chapter Update] Failed to delete old text PDF: ${error.message}`);
                    }
                }
            }

            const textPdfBuffer = textPdfFile.data;
            textPdfFilename = `${chapterId}_text${constants.FILE_EXTENSIONS.PDF}`;
            const textPdfPath = path.join(chapterDir, textPdfFilename);

            textResult = await pdfParse(textPdfBuffer);
            await fsPromises.writeFile(textPdfPath, textPdfBuffer);
            console.log(`[Chapter Update] Updated text PDF for chapter ${chapterId}`);
        }

        // Process visual PDF if provided
        if (visualPdfFile) {
            // Delete old visual PDF and WebP images if exists
            if (existingChapter.visualFilename) {
                const oldVisualPath = path.join(chapterDir, existingChapter.visualFilename);
                try {
                    await fsPromises.unlink(oldVisualPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`[Chapter Update] Failed to delete old visual PDF: ${error.message}`);
                    }
                }
            }

            // Delete old WebP images
            const webpDir = path.join(chapterDir, 'webp');
            try {
                const webpFiles = await fsPromises.readdir(webpDir);
                for (const file of webpFiles) {
                    await fsPromises.unlink(path.join(webpDir, file));
                }
            } catch (error) {
                // WebP directory might not exist, that's okay
            }

            // Delete old WebP images from database
            await dbUtils.deleteChapterImages(chapterId);

            const visualPdfBuffer = visualPdfFile.data;
            visualPdfFilename = `${chapterId}_visual${constants.FILE_EXTENSIONS.PDF}`;
            const visualPdfPath = path.join(chapterDir, visualPdfFilename);

            visualResult = await pdfParse(visualPdfBuffer);
            await fsPromises.writeFile(visualPdfPath, visualPdfBuffer);

            // Convert visual PDF to WebP images
            try {
                console.log(`[Chapter Update] Converting visual PDF to WebP for chapter ${chapterId}...`);
                webpImages = await pdfToWebpUtils.convertPdfToWebp(visualPdfPath, webpDir, 2000);
                console.log(`[Chapter Update] Converted ${webpImages.length} pages to WebP`);

                // Store WebP images in database
                for (let i = 0; i < webpImages.length; i++) {
                    const imgPath = webpImages[i];
                    // Calculate relative path from course uploads directory
                    const courseUploadsDir = fileUtils.getCourseUploadsDir(courseId);
                    const relativePath = path.relative(courseUploadsDir, imgPath);
                    await dbUtils.addChapterImage(chapterId, {
                        imagePath: relativePath,
                        pageNumber: i + 1,
                        imageType: 'webp'
                    });
                }
            } catch (error) {
                console.warn(`[Chapter Update] Failed to convert PDF to WebP: ${error.message}`);
            }

            console.log(`[Chapter Update] Updated visual PDF for chapter ${chapterId}`);
        }

        // Process statements PDF if provided
        if (statementsPdfFile) {
            // Delete old statements PDF if exists
            if (existingChapter.statementsFilename) {
                const oldStatementsPath = path.join(chapterDir, existingChapter.statementsFilename);
                try {
                    await fsPromises.unlink(oldStatementsPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`[Chapter Update] Failed to delete old statements PDF: ${error.message}`);
                    }
                }
            }

            const statementsPdfBuffer = statementsPdfFile.data;
            statementsPdfFilename = `${chapterId}_statements${constants.FILE_EXTENSIONS.PDF}`;
            const statementsPdfPath = path.join(chapterDir, statementsPdfFilename);

            statementsResult = await pdfParse(statementsPdfBuffer);
            await fsPromises.writeFile(statementsPdfPath, statementsPdfBuffer);

            // Extract statements
            statements = await extractStatementsByPage(chapterId, statementsPdfBuffer);
            if (statements.length < (statementsResult?.numpages || 0)) {
                if (pdfjsLib) {
                    try {
                        const loadingTask = pdfjsLib.getDocument({ data: statementsPdfBuffer });
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
                        console.warn('[Chapter Update] Unable to backfill statement pages:', innerError.message);
                    }
                }
            }

            if ((!statements || statements.length === 0) && statementsResult?.text) {
                statements = buildStatementsFromText(chapterId, statementsResult.text);
            }

            console.log(`[Chapter Update] Updated statements PDF for chapter ${chapterId}`);
        }

        // Build updates object
        const updates = {};
        if (chapterName !== undefined) updates.chapterName = chapterName;
        if (chapterDescription !== undefined) updates.chapterDescription = chapterDescription || null;
        if (videoLink !== undefined) updates.videoLink = videoLink || null;

        // Update PDF-related fields if files were provided
        if (textPdfFile) {
            updates.textContent = textResult?.text || null;
            updates.textFilename = textPdfFilename;
            updates.textLength = textResult?.text?.length || 0;
            updates.numPagesText = textResult?.numpages || 0;
        }

        if (visualPdfFile) {
            updates.visualFilename = visualPdfFilename;
            updates.numPagesVisual = visualResult?.numpages || 0;
        }

        if (statementsPdfFile) {
            updates.statementsFilename = statementsPdfFilename;
            updates.statements = statements;
            updates.statementsCount = statements?.length || 0;
            updates.numPagesStatements = statementsResult?.numpages || 0;
        }

        // Update chapter in database
        const updatedChapter = await dbUtils.updateChapter(courseId, chapterId, updates);

        res.json({
            chapterId: updatedChapter.id,
            chapterName: updatedChapter.chapterName,
            chapterDescription: updatedChapter.chapterDescription,
            videoLink: updatedChapter.videoLink,
            textFilename: updatedChapter.textFilename,
            visualFilename: updatedChapter.visualFilename,
            statementsFilename: updatedChapter.statementsFilename,
            numPagesText: updatedChapter.numPagesText,
            numPagesVisual: updatedChapter.numPagesVisual,
            numPagesStatements: updatedChapter.numPagesStatements,
            statementsCount: updatedChapter.statementsCount,
            updatedAt: updatedChapter.updatedAt
        });
    } catch (error) {
        console.error("[Chapter Update Error]:", error);
        res.status(500).json({
            error: 'Failed to update chapter.',
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

        // First check if chapter exists in database
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Delete from database first
        const dbDeleted = await dbUtils.deleteChapter(courseId, chapterId);
        if (!dbDeleted) {
            return res.status(404).json({ error: 'Chapter not found in database' });
        }

        // Then delete file assets (this may fail if files don't exist, but that's okay)
        try {
            await fileUtils.deleteChapterAssets(courseId, chapterId);
        } catch (fileError) {
            // Log but don't fail - database record is already deleted
            console.warn("[Chapter Delete] Warning: Failed to delete some file assets:", fileError.message);
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
    regenerateChapterTTS,
    regenerateChapterLipSync,
    createChapter,
    getChapters,
    getChapter,
    getChapterFile,
    getChapterLipSync,
    getChapterPageLipSync,
    summarizeChapter,
    generateChapterLipSync,
    getChapterPageTimings,
    getChapterPageAudio,
    generateChapterPageAudio,
    getChapterStatements,
    updateChapter,
    deleteChapter
};

