const crypto = require('crypto');
const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const freeAIService = require('../services/freeAIService');
const config = require('../config/config');
const constants = require('../utils/constants');

/**
 * Answer general questions using free AI services (fallback to Google if needed)
 * POST /api/qa
 */
async function answerQuestion(req, res) {
    try {
        // Question and useFreeAI validation handled by middleware
        const { question, useFreeAI = true } = req.body;

        console.log(`[QA] Answering general question (using ${useFreeAI ? 'free AI' : 'Google Gemini'})`);

        // System prompt for the QA assistant
        const systemPrompt = `Vous êtes un assistant de culture générale efficace et concis. Répondez précisément à la question de l'utilisateur de manière concise et informative. Si vous ne connaissez pas la réponse exacte, fournissez un résumé complet en trois lignes basé sur vos connaissances générales.`;

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
            res.json({
                answer: answer,
                ...(audioUrl && { audioUrl: audioUrl }),
                provider: useFreeAI && process.env.USE_FREE_AI !== 'false' ? 'free' : 'google',
                hasAudio: !!audioUrl
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

module.exports = {
    answerQuestion,
};

