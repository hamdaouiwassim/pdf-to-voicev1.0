const crypto = require('crypto');
const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const config = require('../config/config');

/**
 * Answer general questions using Google Search
 * POST /api/qa
 */
async function answerQuestion(req, res) {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return res.status(400).json({ error: 'Valid question is required' });
        }

        console.log(`[QA] Answering general question using Google Search`);

        // System prompt for the QA assistant
        const systemPrompt = `Vous êtes un assistant de culture générale efficace et concis. Utilisez la recherche Google pour trouver des informations pertinentes et actualisées afin de répondre précisément à la question de l'utilisateur. Si vous ne trouvez pas la réponse exacte, fournissez un résumé complet en trois lignes basé sur les résultats de la recherche.`;

        // Generate text answer with Google Search grounding
        const answer = await geminiService.generateText(question.trim(), systemPrompt);

        // Generate TTS audio for the answer
        const { pcmBuffer } = await geminiService.generateTTS(answer, config.TTS_VOICE_QA);

        // Convert PCM to WAV
        const wavBuffer = audioUtils.pcmToWav(pcmBuffer);

        // Save audio file with unique ID
        const qaAudioId = `qa-${crypto.randomUUID()}`;
        await fileUtils.saveAudioFile(qaAudioId, wavBuffer);

        // Return answer and audio URL
        res.json({
            answer: answer,
            audioUrl: `/api/audio/${qaAudioId}`
        });
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

