const fileUtils = require('../utils/fileUtils');
const audioUtils = require('../utils/audioUtils');
const geminiService = require('../services/geminiService');
const config = require('../config/config');

/**
 * Generate or retrieve cached TTS audio for a document
 * POST /api/tts
 */
async function generateTTS(req, res) {
    try {
        const { docId } = req.body;

        if (!docId) {
            return res.status(400).json({ error: 'Document ID is required' });
        }

        const text = await fileUtils.getAITextByDocId(docId);

        if (!text) {
            return res.status(404).json({ error: 'Document content not found' });
        }

        // Check for cached audio
        if (fileUtils.audioFileExists(docId)) {
            console.log(`[TTS] Serving cached audio for doc ID: ${docId}`);
            try {
                const fileBuffer = await fileUtils.readAudioFile(docId);
                return res.json({
                    audioData: fileBuffer.toString('base64'),
                    mimeType: 'audio/wav'
                });
            } catch (error) {
                console.warn(`[TTS] Failed to read cached file, regenerating. Error: ${error.message}`);
                // Fall through to regeneration
            }
        }

        // Generate new audio
        console.log(`[TTS] Cache miss. Generating new voice for doc ID: ${docId}, length: ${text.length} chars`);
        
        const { pcmBuffer } = await geminiService.generateTTS(text, config.TTS_VOICE_DOCUMENT);
        
        // Convert PCM to WAV and save
        const wavBuffer = audioUtils.pcmToWav(pcmBuffer);
        await fileUtils.saveAudioFile(docId, wavBuffer);
        
        console.log(`[TTS] Saved new audio cache for doc ID: ${docId}`);

        res.json({
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

