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
async function generateSummary(text, language = 'fr') {
    let systemPrompt;
    let query;
    
    if (language === 'fr') {
        systemPrompt = 'Vous êtes un assistant expert en résumé de documents. Créez un résumé concis et complet du texte fourni, en mettant en évidence les points clés et les informations importantes. Répondez UNIQUEMENT en français.';
        query = `Résumez le texte suivant de manière concise et complète:\n\n${text}`;
    } else if (language === 'es') {
        systemPrompt = 'Eres un asistente experto en resumen de documentos. Crea un resumen conciso y completo del texto proporcionado, destacando los puntos clave y la información importante. Responde SOLO en español.';
        query = `Resume el siguiente texto de manera concisa y completa:\n\n${text}`;
    } else if (language === 'de') {
        systemPrompt = 'Sie sind ein Experten-Assistent für Dokumentenzusammenfassung. Erstellen Sie eine prägnante und umfassende Zusammenfassung des bereitgestellten Texts, wobei Sie die wichtigsten Punkte und Informationen hervorheben. Antworten Sie NUR auf Deutsch.';
        query = `Fassen Sie den folgenden Text prägnant und umfassend zusammen:\n\n${text}`;
    } else if (language === 'it') {
        systemPrompt = 'Sei un assistente esperto nella sintesi di documenti. Crea un riassunto conciso e completo del testo fornito, evidenziando i punti chiave e le informazioni importanti. Rispondi SOLO in italiano.';
        query = `Riassumi il seguente testo in modo conciso e completo:\n\n${text}`;
    } else if (language === 'pt') {
        systemPrompt = 'Você é um assistente especializado em resumo de documentos. Crie um resumo conciso e completo do texto fornecido, destacando os pontos-chave e informações importantes. Responda APENAS em português.';
        query = `Resuma o seguinte texto de forma concisa e completa:\n\n${text}`;
    } else {
        // Default to English
        systemPrompt = 'You are an expert document summarization assistant. Create a concise and comprehensive summary of the provided text, highlighting key points and important information. Respond ONLY in English.';
        query = `Please summarize the following text:\n\n${text}`;
    }

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

    // Clean the text to remove any potential instructions, prompts, or markdown
    // Remove common instruction patterns that might confuse the TTS model
    let cleanText = contentForTTS.trim();
    
    // Remove markdown formatting
    cleanText = cleanText.replace(/\*\*/g, ''); // Remove bold
    cleanText = cleanText.replace(/\*/g, ''); // Remove italic
    cleanText = cleanText.replace(/#{1,6}\s/g, ''); // Remove headers
    cleanText = cleanText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove links, keep text
    cleanText = cleanText.replace(/```[\s\S]*?```/g, ''); // Remove code blocks
    cleanText = cleanText.replace(/`([^`]+)`/g, '$1'); // Remove inline code
    
    // Remove instruction-like phrases that might trigger text generation
    cleanText = cleanText.replace(/^(explain|describe|tell|say|generate|create|write|provide|give|show|list|outline|summarize|analyze|discuss|define|compare|contrast|evaluate|identify|explain why|explain how|what is|what are|how does|why does|when does|where does)/i, '');
    cleanText = cleanText.replace(/^(you should|you must|you need|you can|you will|you are|please|note:|important:|warning:|tip:|remember:|note that)/i, '');
    
    // Final trim
    cleanText = cleanText.trim();

    // Ensure we have text to convert
    if (!cleanText || cleanText.length === 0) {
        throw new Error("No valid text to convert to speech after cleaning");
    }

    const response = await ai.models.generateContent({
        model: config.GEMINI_TTS_MODEL,
        contents: [{ parts: [{ text: cleanText }] }],
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

/**
 * Generates TTS audio for quiz feedback using stricter instructions.
 * @param {string} text - Text to convert to speech
 * @param {string} voiceName - Voice name (default: QA voice)
 * @returns {Promise<{pcmBuffer: Buffer, mimeType: string}>}
 */
async function generateQuizFeedbackTTS(text, voiceName = config.TTS_VOICE_QA) {
    // Limit text length for TTS
    const contentForTTS = text.substring(0, config.TTS_TEXT_LIMIT);
    let cleanText = contentForTTS.trim();

    // Remove markdown formatting
    cleanText = cleanText.replace(/\*\*/g, '');
    cleanText = cleanText.replace(/\*/g, '');
    cleanText = cleanText.replace(/#{1,6}\s/g, '');
    cleanText = cleanText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
    cleanText = cleanText.replace(/`([^`]+)`/g, '$1');

    cleanText = cleanText.trim();

    if (!cleanText || cleanText.length === 0) {
        throw new Error("No valid quiz feedback text to convert to speech after cleaning");
    }

    const response = await ai.models.generateContent({
        model: config.GEMINI_TTS_MODEL,
        systemInstruction: {
            parts: [{
                text: 'You are a text-to-speech system. Read the provided text aloud exactly as given. Do not answer, explain, or generate any text. Output audio only.'
            }]
        },
        contents: [{ parts: [{ text: cleanText }] }],
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
        throw new Error("Quiz TTS API returned no audio data.");
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
    generateQuizFeedbackTTS,
    generateSummary,
};

