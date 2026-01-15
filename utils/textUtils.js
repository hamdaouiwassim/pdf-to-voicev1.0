/**
 * Text utility functions for processing text before TTS
 */

/**
 * Removes "next slide" markers and "Titan Academy" from text
 * This ensures TTS audio doesn't pronounce these markers and matches page timing calculations
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text with markers removed
 */
function removeSlideMarkers(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Remove "next slide" markers (case-insensitive)
    const nextSlideMarker = /next\s+slide/gi;
    let cleaned = text.replace(nextSlideMarker, ' ');

    // Remove "Titan Academy" (case-insensitive)
    const excludeFromCount = /titan\s+academy/gi;
    cleaned = cleaned.replace(excludeFromCount, ' ');

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Cleans text for TTS conversion by removing problematic characters and markers
 * This is a comprehensive cleaning function that removes:
 * - HTML tags
 * - "next slide" markers
 * - "Titan Academy" text
 * - URLs and email addresses
 * - Problematic punctuation
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text optimized for TTS
 */
function cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let cleaned = text;

    // Remove HTML tags and entities
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, ' et ');
    cleaned = cleaned.replace(/&lt;/g, ' moins que ');
    cleaned = cleaned.replace(/&gt;/g, ' plus que ');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#39;/g, "'");
    cleaned = cleaned.replace(/&[a-z]+;/gi, ' ');

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, 'lien web');
    cleaned = cleaned.replace(/www\.[^\s]+/gi, 'lien web');

    // Remove email addresses
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'adresse email');

    // Remove "next slide" markers (CRITICAL: must match page timings calculation)
    const nextSlideMarker = /next\s+slide/gi;
    cleaned = cleaned.replace(nextSlideMarker, ' ');

    // Remove "Titan Academy" (must match page timings calculation)
    const excludeFromCount = /titan\s+academy/gi;
    cleaned = cleaned.replace(excludeFromCount, ' ');

    // Replace problematic punctuation
    cleaned = cleaned.replace(/[•·▪▫]/g, ' ');
    cleaned = cleaned.replace(/[—–]/g, '-');
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");
    cleaned = cleaned.replace(/[…]/g, '...');

    // Normalize whitespace
    cleaned = cleaned.replace(/\r\n/g, ' ');
    cleaned = cleaned.replace(/\r/g, ' ');
    cleaned = cleaned.replace(/\n/g, ' ');
    cleaned = cleaned.replace(/\t/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim();

    // Ensure text ends with punctuation
    if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
        cleaned += '.';
    }

    return cleaned.trim();
}

module.exports = {
    removeSlideMarkers,
    cleanTextForTTS
};
