/**
 * Page-based TTS Service
 * Generates individual TTS audio files for each page/slide
 * Ensures perfect synchronization between audio and page timings
 */

const geminiService = require('./geminiService');
const audioUtils = require('../utils/audioUtils');
const fileUtils = require('../utils/fileUtils');
const textUtils = require('../utils/textUtils');
const lipSyncService = require('./lipSyncService');
const config = require('../config/config');
const path = require('path');
const fsPromises = require('fs').promises;

/**
 * Generate TTS audio for a single page
 * @param {string} pageText - Text content for the page
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} language - Language code (optional)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<{duration: number, audioPath: string, lipSyncPath: string}>} Duration and paths
 */
async function generatePageTTS(pageText, chapterId, pageNumber, language = 'fr-FR', courseId = null) {
    if (!pageText || pageText.trim().length === 0) {
        throw new Error(`Empty text for page ${pageNumber}`);
    }

    // Check if audio already exists
    if (await fileUtils.pageAudioFileExists(chapterId, pageNumber, courseId)) {
        console.log(`[Page TTS] Audio already exists for chapter ${chapterId}, page ${pageNumber}`);
        const audioBuffer = await fileUtils.readPageAudioFile(chapterId, pageNumber, courseId);
        const duration = await fileUtils.getAudioDuration(audioBuffer);
        const audioPath = fileUtils.getPageAudioFilePath(chapterId, pageNumber, courseId);
        const lipSyncPath = fileUtils.getPageLipSyncFilePath(chapterId, pageNumber, courseId);
        if (!(await fileUtils.pageLipSyncFileExists(chapterId, pageNumber, courseId))) {
            await fsPromises.mkdir(path.dirname(lipSyncPath), { recursive: true });
            await lipSyncService.generateLipSync(audioPath, lipSyncPath);
        }
        return {
            duration,
            audioPath,
            lipSyncPath
        };
    }

    // Clean text (remove markers)
    const cleanedText = textUtils.removeSlideMarkers(pageText);
    
    if (!cleanedText || cleanedText.trim().length === 0) {
        throw new Error(`No text content after cleaning for page ${pageNumber}`);
    }

    console.log(`[Page TTS] Generating audio for chapter ${chapterId}, page ${pageNumber} (${cleanedText.length} chars) using Gemini TTS`);

    // Use only Gemini TTS
    const result = await geminiService.generateTTS(cleanedText, config.TTS_VOICE_DOCUMENT);
    const pcmBuffer = result.pcmBuffer;
    
    // Convert PCM to WAV
    const audioBuffer = audioUtils.pcmToWav(pcmBuffer);
    
    // Calculate actual duration from WAV
    const duration = await fileUtils.getAudioDuration(audioBuffer);
    
    // Save audio file
    await fileUtils.savePageAudioFile(chapterId, pageNumber, audioBuffer, courseId);

    const audioPath = fileUtils.getPageAudioFilePath(chapterId, pageNumber, courseId);
    const lipSyncPath = fileUtils.getPageLipSyncFilePath(chapterId, pageNumber, courseId);
    console.log(`[Page TTS] Saved audio: ${audioPath}`);
    await fsPromises.mkdir(path.dirname(lipSyncPath), { recursive: true });
    await lipSyncService.generateLipSync(audioPath, lipSyncPath);
    console.log(`[Page TTS] Generated lip sync: ${lipSyncPath}`);
    
    console.log(`[Page TTS] Generated via Gemini TTS for page ${pageNumber}, duration: ${duration}s`);

    return {
        duration,
        audioPath,
        lipSyncPath
    };
}

/**
 * Generate TTS audio for all pages in a chapter
 * @param {Array} pageDataArray - Array of {page: number, text: string} objects
 * @param {string} chapterId - Chapter ID
 * @param {string} language - Language code (optional)
 * @param {number} maxConcurrent - Maximum concurrent TTS generations (default: 3)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<Array>} Array of {page: number, duration: number, audioPath: string}
 */
async function generateAllPagesTTS(pageDataArray, chapterId, language = 'fr-FR', maxConcurrent = 3, courseId = null) {
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
                    language,
                    courseId
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
