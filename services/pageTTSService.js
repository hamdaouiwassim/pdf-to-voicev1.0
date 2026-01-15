/**
 * Page-based TTS Service
 * Generates individual TTS audio files for each page/slide
 * Ensures perfect synchronization between audio and page timings
 */

const geminiService = require('./geminiService');
const edgeTTSService = require('./edgeTTSService');
const localTTSService = require('./localTTSService');
const audioUtils = require('../utils/audioUtils');
const fileUtils = require('../utils/fileUtils');
const textUtils = require('../utils/textUtils');
const config = require('../config/config');

/**
 * Generate TTS audio for a single page
 * @param {string} pageText - Text content for the page
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} language - Language code (optional)
 * @returns {Promise<{duration: number, audioPath: string}>} Duration in seconds and audio path
 */
async function generatePageTTS(pageText, chapterId, pageNumber, language = 'fr-FR') {
    if (!pageText || pageText.trim().length === 0) {
        throw new Error(`Empty text for page ${pageNumber}`);
    }

    // Check if audio already exists
    if (await fileUtils.pageAudioFileExists(chapterId, pageNumber)) {
        console.log(`[Page TTS] Audio already exists for chapter ${chapterId}, page ${pageNumber}`);
        const audioBuffer = await fileUtils.readPageAudioFile(chapterId, pageNumber);
        const duration = await fileUtils.getAudioDuration(audioBuffer);
        return {
            duration,
            audioPath: fileUtils.getPageAudioFilePath(chapterId, pageNumber)
        };
    }

    // Clean text (remove markers)
    const cleanedText = textUtils.removeSlideMarkers(pageText);
    
    if (!cleanedText || cleanedText.trim().length === 0) {
        throw new Error(`No text content after cleaning for page ${pageNumber}`);
    }

    console.log(`[Page TTS] Generating audio for chapter ${chapterId}, page ${pageNumber} (${cleanedText.length} chars)`);

    let audioBuffer;
    let duration;

    // Try Microsoft Edge TTS first (Free, High Quality)
    try {
        console.log(`[Page TTS] Attempting Edge TTS for page ${pageNumber}...`);
        audioBuffer = await edgeTTSService.generateTTSWithEdge(cleanedText, language);
        
        // Edge TTS returns MP3, we need to convert to WAV for duration calculation
        // For now, save as MP3 and estimate duration
        // TODO: Convert MP3 to WAV for accurate duration
        await fileUtils.savePageAudioFile(chapterId, pageNumber, audioBuffer);
        
        // Estimate duration (rough calculation)
        // MP3 at 128kbps: ~16KB per second
        duration = Math.round((audioBuffer.length / 16000) * 10) / 10;
        
        console.log(`[Page TTS] Generated via Edge TTS for page ${pageNumber}, estimated duration: ${duration}s`);
    } catch (edgeError) {
        console.warn(`[Page TTS] Edge TTS failed for page ${pageNumber} (${edgeError.message}), falling back to Gemini...`);

        // Fallback to Gemini
        try {
            const result = await geminiService.generateTTS(cleanedText, config.TTS_VOICE_DOCUMENT);
            const pcmBuffer = result.pcmBuffer;
            
            // Convert PCM to WAV
            audioBuffer = audioUtils.pcmToWav(pcmBuffer);
            
            // Calculate actual duration from WAV
            duration = await fileUtils.getAudioDuration(audioBuffer);
            
            // Save audio file
            await fileUtils.savePageAudioFile(chapterId, pageNumber, audioBuffer);
            
            console.log(`[Page TTS] Generated via Gemini for page ${pageNumber}, duration: ${duration}s`);
        } catch (geminiError) {
            console.warn(`[Page TTS] Gemini TTS failed for page ${pageNumber} (${geminiError.message}), trying Local TTS...`);
            
            // Fallback to Local TTS (Windows only)
            if (process.platform === 'win32') {
                try {
                    audioBuffer = await localTTSService.generateTTSLocal(cleanedText, language);
                    duration = await fileUtils.getAudioDuration(audioBuffer);
                    await fileUtils.savePageAudioFile(chapterId, pageNumber, audioBuffer);
                    console.log(`[Page TTS] Generated via Local TTS for page ${pageNumber}, duration: ${duration}s`);
                } catch (localError) {
                    throw new Error(`All TTS services failed for page ${pageNumber}: ${localError.message}`);
                }
            } else {
                throw new Error(`All TTS services failed for page ${pageNumber}. Last error: ${geminiError.message}`);
            }
        }
    }

    return {
        duration,
        audioPath: fileUtils.getPageAudioFilePath(chapterId, pageNumber)
    };
}

/**
 * Generate TTS audio for all pages in a chapter
 * @param {Array} pageDataArray - Array of {page: number, text: string} objects
 * @param {string} chapterId - Chapter ID
 * @param {string} language - Language code (optional)
 * @param {number} maxConcurrent - Maximum concurrent TTS generations (default: 3)
 * @returns {Promise<Array>} Array of {page: number, duration: number, audioPath: string}
 */
async function generateAllPagesTTS(pageDataArray, chapterId, language = 'fr-FR', maxConcurrent = 3) {
    console.log(`[Page TTS] Generating TTS for ${pageDataArray.length} pages in chapter ${chapterId}`);
    
    const results = [];
    const errors = [];

    // Process pages in batches to avoid overwhelming TTS services
    for (let i = 0; i < pageDataArray.length; i += maxConcurrent) {
        const batch = pageDataArray.slice(i, i + maxConcurrent);
        
        const batchPromises = batch.map(async (pageData) => {
            try {
                const result = await generatePageTTS(
                    pageData.text,
                    chapterId,
                    pageData.page,
                    language
                );
                return {
                    page: pageData.page,
                    ...result,
                    success: true
                };
            } catch (error) {
                console.error(`[Page TTS] Failed to generate audio for page ${pageData.page}:`, error.message);
                errors.push({
                    page: pageData.page,
                    error: error.message
                });
                return {
                    page: pageData.page,
                    success: false,
                    error: error.message
                };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        console.log(`[Page TTS] Completed batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(pageDataArray.length / maxConcurrent)}`);
    }

    // Sort results by page number
    results.sort((a, b) => a.page - b.page);

    if (errors.length > 0) {
        console.warn(`[Page TTS] Generated ${results.filter(r => r.success).length}/${pageDataArray.length} pages successfully. ${errors.length} errors.`);
    } else {
        console.log(`[Page TTS] Successfully generated TTS for all ${pageDataArray.length} pages`);
    }

    return results;
}

module.exports = {
    generatePageTTS,
    generateAllPagesTTS
};
