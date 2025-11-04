const { GoogleGenAI } = require('@google/genai');
const config = require('../config/config');

// Initialize Gemini Client
const ai = new GoogleGenAI(config.GEMINI_API_KEY);

/**
 * Generates text content using Gemini AI with Google Search grounding.
 * @param {string} query - The user query/question
 * @param {string} systemPrompt - System instruction for the model
 * @param {boolean} useGoogleSearch - Whether to enable Google Search (default: true)
 * @returns {Promise<string>} Generated text response
 */
async function generateText(query, systemPrompt = null, useGoogleSearch = true) {
    const textPayload = {
        contents: [{ parts: [{ text: query }] }],
    };

    if (systemPrompt) {
        textPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    // Enable Google Search for grounding if requested
    if (useGoogleSearch) {
        textPayload.tools = [{ "google_search": {} }];
    }

    const response = await fetch(config.GEMINI_TEXT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Text generation failed: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    const answer = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!answer) {
        throw new Error('Could not retrieve a valid text response.');
    }

    return answer;
}

/**
 * Generates a summary of the provided text using Gemini AI.
 * @param {string} text - The text to summarize
 * @param {string} language - Language for the summary (default: 'en' for English)
 * @returns {Promise<string>} Generated summary
 */
async function generateSummary(text, language = 'en') {
    const systemPrompt = language === 'fr' 
        ? 'Vous êtes un assistant expert en résumé de documents. Créez un résumé concis et complet du texte fourni, en mettant en évidence les points clés et les informations importantes.'
        : 'You are an expert document summarization assistant. Create a concise and comprehensive summary of the provided text, highlighting key points and important information.';

    const query = `Please summarize the following text:\n\n${text}`;

    // Don't use Google Search for summaries - only use the document content
    return await generateText(query, systemPrompt, false);
}

/**
 * Generates TTS audio using Gemini TTS API.
 * @param {string} text - Text to convert to speech
 * @param {string} voiceName - Voice name (default: 'Kore')
 * @returns {Promise<{pcmBuffer: Buffer, mimeType: string}>}
 */
async function generateTTS(text, voiceName = config.TTS_VOICE_DOCUMENT) {
    // Limit text length for TTS
    const contentForTTS = text.substring(0, config.TTS_TEXT_LIMIT);

    const response = await ai.models.generateContent({
        model: config.GEMINI_TTS_MODEL,
        contents: [{ parts: [{ text: contentForTTS }] }],
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            }
        }
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const rawPcmBase64 = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType;

    if (!rawPcmBase64) {
        throw new Error("TTS API returned no audio data.");
    }

    const pcmBuffer = Buffer.from(rawPcmBase64, 'base64');
    
    return {
        pcmBuffer,
        mimeType: mimeType || 'audio/L16;rate=24000'
    };
}

module.exports = {
    generateText,
    generateTTS,
    generateSummary,
};

