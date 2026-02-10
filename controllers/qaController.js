const crypto = require('crypto');
const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const freeAIService = require('../services/freeAIService');
const config = require('../config/config');
const constants = require('../utils/constants');
const db = require('../config/database');

const MAX_HISTORY_CONTEXT = 5;

function buildHistoryContext(historyItems) {
    if (!Array.isArray(historyItems) || historyItems.length === 0) {
        return '';
    }

    const recent = historyItems.slice(0, MAX_HISTORY_CONTEXT);
    const lines = recent.map((item, index) => {
        const question = String(item.question || '').trim();
        const answer = String(item.answer || '').trim();
        if (!question || !answer) return null;
        return `${index + 1}. Q: ${question}\n   R: ${answer}`;
    }).filter(Boolean);

    if (lines.length === 0) {
        return '';
    }

    return `Historique récent:\n${lines.join('\n')}`;
}

function buildCourseContext({ courseName, chapterName, pageNumber }) {
    const parts = [];
    if (courseName) parts.push(`Cours: ${courseName}`);
    if (chapterName) parts.push(`Chapitre: ${chapterName}`);
    if (pageNumber) parts.push(`Page: ${pageNumber}`);
    if (parts.length === 0) return '';
    return `Contexte du cours:\n${parts.join('\n')}`;
}

async function loadRecentHistory({ userId, courseId, chapterId }) {
    if (!userId || !courseId) return [];

    const params = [userId, courseId];
    let chapterClause = '';
    const normalizedChapterId = typeof chapterId === 'string' ? chapterId.trim() : '';
    if (normalizedChapterId) {
        chapterClause = ' AND chapter_id = ?';
        params.push(normalizedChapterId);
    }

    const rows = await db.query(
        `SELECT question, answer
         FROM qa_history
         WHERE user_id = ? AND course_id = ?${chapterClause}
         ORDER BY created_at DESC
         LIMIT ${MAX_HISTORY_CONTEXT}`,
        params
    );

    return rows || [];
}

/**
 * Answer general questions using free AI services (fallback to Google if needed)
 * POST /api/qa
 */
async function answerQuestion(req, res) {
    try {
        // Question and useFreeAI validation handled by middleware
        const {
            question,
            useFreeAI = true,
            courseId,
            chapterId,
            courseName,
            chapterName,
            pageNumber,
            history
        } = req.body;

        console.log(`[QA] Answering general question (using ${useFreeAI ? 'free AI' : 'Google Gemini'})`);

        // System prompt for the QA assistant
        let systemPrompt = `Vous êtes un assistant de culture générale efficace et concis. Répondez précisément à la question de l'utilisateur de manière concise et informative. Si vous ne connaissez pas la réponse exacte, fournissez un résumé complet en trois lignes basé sur vos connaissances générales.`;

        const userId = req.session?.userId || null;
        const normalizedCourseName = typeof courseName === 'string' ? courseName.trim() : '';
        const normalizedChapterName = typeof chapterName === 'string' ? chapterName.trim() : '';
        const normalizedPage = Number.isFinite(Number(pageNumber)) ? Number(pageNumber) : null;

        const courseContext = buildCourseContext({
            courseName: normalizedCourseName,
            chapterName: normalizedChapterName,
            pageNumber: normalizedPage
        });

        let historyContext = '';
        if (Array.isArray(history) && history.length > 0) {
            historyContext = buildHistoryContext(history);
        } else {
            const recentHistory = await loadRecentHistory({
                userId,
                courseId,
                chapterId
            });
            historyContext = buildHistoryContext(recentHistory);
        }

        if (courseContext || historyContext) {
            systemPrompt = [
                systemPrompt,
                courseContext,
                historyContext,
                'Si possible, relie ta réponse au contexte du cours et aux questions précédentes.'
            ].filter(Boolean).join('\n\n');
        }

        let answer;
        let audioBuffer = null;
        let audioUrl = null;

        try {
            // Try free AI services first (if enabled)
            if (useFreeAI && process.env.USE_FREE_AI !== 'false') {
                try {
                    answer = await freeAIService.generateFreeQAAnswer(question.trim(), systemPrompt);
                    console.log(`[QA] Generated answer using free AI service`);

                    // Try to generate audio using Gemini TTS only
                    try {
                        const { pcmBuffer } = await geminiService.generateTTS(answer, config.TTS_VOICE_QA);
                        audioBuffer = audioUtils.pcmToWav(pcmBuffer);
                        console.log(`[QA] Generated audio using Gemini TTS`);
                    } catch (geminiError) {
                        console.warn(`[QA] Gemini TTS failed (${geminiError.message}). Audio generation skipped.`);
                        // Continue without audio - answer is still available
                        audioBuffer = null;
                    }
                } catch (freeAIError) {
                    console.warn(`[QA] Free AI failed, falling back to Google Gemini:`, freeAIError.message);
                    try {
                        // Fallback to Google Gemini for text generation
                        answer = await geminiService.generateText(question.trim(), systemPrompt);

                        // Try to generate audio using Gemini TTS only
                        try {
                            const { pcmBuffer } = await geminiService.generateTTS(answer, config.TTS_VOICE_QA);
                            audioBuffer = audioUtils.pcmToWav(pcmBuffer);
                            console.log(`[QA] Generated audio using Gemini TTS`);
                        } catch (geminiError) {
                            console.warn(`[QA] Gemini TTS failed (${geminiError.message}). Audio generation skipped.`);
                            audioBuffer = null;
                        }
                    } catch (geminiError) {
                        // If even Gemini text generation fails, throw error
                        throw geminiError;
                    }
                }
            } else {
                // Use Google Gemini (original behavior)
                answer = await geminiService.generateText(question.trim(), systemPrompt);

                // Try to generate audio using Gemini TTS only
                try {
                    const { pcmBuffer } = await geminiService.generateTTS(answer, config.TTS_VOICE_QA);
                    audioBuffer = audioUtils.pcmToWav(pcmBuffer);
                    console.log(`[QA] Generated audio using Gemini TTS`);
                } catch (geminiError) {
                    console.warn(`[QA] Gemini TTS failed (${geminiError.message}). Audio generation skipped.`);
                    audioBuffer = null;
                }
            }

            // Save audio file if audio was generated
            if (audioBuffer) {
                try {
                    const qaAudioId = `${constants.AUDIO_PREFIXES.QA}${crypto.randomUUID()}`;
                    await fileUtils.saveAudioFile(qaAudioId, audioBuffer);
                    audioUrl = `/api/audio/${qaAudioId}`;
                } catch (saveError) {
                    console.warn(`[QA] Failed to save audio file:`, saveError.message);
                    // Continue without audio URL
                }
            }

            // Return answer (with or without audio)
            let historyId = null;

            if (userId && courseId && question && answer) {
                try {
                    const insertResult = await db.query(
                        `INSERT INTO qa_history (user_id, course_id, chapter_id, question, answer, audio_url)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            courseId,
                            chapterId || null,
                            question.trim(),
                            answer,
                            audioUrl || null
                        ]
                    );
                    historyId = insertResult?.insertId || null;
                } catch (historyError) {
                    console.warn('[QA] Failed to save history:', historyError.message);
                }
            }

            res.json({
                answer: answer,
                ...(audioUrl && { audioUrl: audioUrl }),
                provider: useFreeAI && process.env.USE_FREE_AI !== 'false' ? 'free' : 'google',
                hasAudio: !!audioUrl,
                ...(historyId && { historyId })
            });
        } catch (error) {
            // If text generation fails completely, return error
            throw new Error(`Failed to generate answer. Error: ${error.message}`);
        }
    } catch (error) {
        console.error("[QA Error]:", error);
        res.status(500).json({
            error: 'Q&A failed.',
            details: error.message
        });
    }
}

/**
 * Get QA history for a course
 * GET /api/qa/history
 */
async function getHistory(req, res) {
    try {
        const userId = req.session?.userId;
        const { courseId, chapterId, limit } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!courseId || typeof courseId !== 'string') {
            return res.status(400).json({ error: 'courseId is required' });
        }

        const safeLimit = Math.min(Number(limit) || 50, 200);
        const params = [userId, courseId];
        let chapterClause = '';
        const normalizedChapterId = typeof chapterId === 'string' ? chapterId.trim() : '';
        if (normalizedChapterId) {
            chapterClause = ' AND chapter_id = ?';
            params.push(normalizedChapterId);
        }

        const rows = await db.query(
            `SELECT id, question, answer, audio_url AS audioUrl, created_at AS timestamp
             FROM qa_history
             WHERE user_id = ? AND course_id = ?${chapterClause}
             ORDER BY created_at DESC
             LIMIT ${safeLimit}`,
            params
        );

        res.json({
            items: rows || []
        });
    } catch (error) {
        console.error('[QA History Error]:', error);
        res.status(500).json({
            error: 'Failed to fetch history',
            details: error.message
        });
    }
}

module.exports = {
    answerQuestion,
    getHistory
};

