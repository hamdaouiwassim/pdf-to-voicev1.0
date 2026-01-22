/**
 * Shared PDF text extraction utility
 * Used by both page timings and TTS generation to ensure perfect synchronization
 */

const pdfParse = require('pdf-parse');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const constants = require('./constants');
const fileUtils = require('./fileUtils');

// Lazy load pdfjs-dist (same as in controllers)
let pdfjsLib = null;
try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (error) {
    console.warn('[PDF Text Extractor] pdfjs-dist not available, will use pdf-parse fallback');
}

/**
 * Extract and clean text from TEXT PDF for TTS generation
 * Returns the full cleaned text (without "next slide" and "Titan Academy")
 * This ensures perfect synchronization with page timings calculations
 * 
 * @param {string} textPdfPath - Path to the TEXT PDF file
 * @returns {Promise<string>} Cleaned text ready for TTS
 */
async function extractTextForTTS(textPdfPath) {
    if (!(await fileUtils.fileExists(textPdfPath))) {
        throw new Error(`Text PDF not found: ${textPdfPath}`);
    }

    const pdfBuffer = await fsPromises.readFile(textPdfPath);
    let pdfData, fullPdfText;
    
    try {
        pdfData = await pdfParse(pdfBuffer);
        fullPdfText = pdfData.text || '';
    } catch (pdfError) {
        throw new Error(`PDF parsing error: ${pdfError.message}`);
    }

    // Remove markers (same logic as page timings)
    // This ensures TTS audio matches exactly with timing calculations
    const nextSlideMarker = /next\s+slide/gi;
    const excludeFromCount = /titan\s+academy/gi;
    
    let cleanedText = fullPdfText.replace(nextSlideMarker, ' ');
    cleanedText = cleanedText.replace(excludeFromCount, ' ');
    
    // Normalize whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

    return cleanedText;
}

/**
 * Get TEXT PDF path for a document or chapter
 * @param {string} docId - Document or chapter ID
 * @param {Object} metadata - Document metadata (optional, will be fetched if not provided)
 * @param {string} courseId - Course ID (for chapters, optional)
 * @returns {Promise<string>} Path to TEXT PDF
 */
async function getTextPdfPath(docId, metadata = null, courseId = null) {
    // If courseId is provided, it's a chapter
    if (courseId) {
        const dbUtils = require('./dbUtils');
        const chapter = await dbUtils.getChapterById(courseId, docId);
        if (!chapter) {
            throw new Error('Chapter not found');
        }
        if (!chapter.textFilename) {
            throw new Error('Chapter text PDF filename not found');
        }
        // Use new structure
        const fileUtils = require('./fileUtils');
        const chapterDir = fileUtils.getChapterUploadsDir(courseId, docId);
        return path.join(chapterDir, chapter.textFilename);
    }

    // Otherwise, it's a document
    if (!metadata) {
        metadata = await fileUtils.getDocumentMetadata(docId);
    }
    
    if (!metadata) {
        throw new Error('Document not found');
    }

    if (metadata.isDualMode && metadata.textFilename && metadata.visualFilename) {
        // New format: dual PDF mode - use text PDF
        return path.join(config.UPLOADS_DIR, metadata.textFilename);
    } else {
        // Legacy format: single PDF
        return path.join(config.UPLOADS_DIR, `${docId}${constants.FILE_EXTENSIONS.PDF}`);
    }
}

/**
 * Extract text from TEXT PDF for TTS (handles both documents and chapters)
 * @param {string} docId - Document or chapter ID
 * @param {string} courseId - Course ID (for chapters, optional)
 * @returns {Promise<string>} Cleaned text ready for TTS
 */
async function extractTextForTTSById(docId, courseId = null) {
    const metadata = courseId ? null : await fileUtils.getDocumentMetadata(docId);
    const textPdfPath = await getTextPdfPath(docId, metadata, courseId);
    return await extractTextForTTS(textPdfPath);
}

module.exports = {
    extractTextForTTS,
    getTextPdfPath,
    extractTextForTTSById
};
