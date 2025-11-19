const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const constants = require('./constants');

/**
 * Ensures all necessary directories exist on server startup.
 */
function setupDirectories() {
    if (!fs.existsSync(config.UPLOADS_DIR)) {
        fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });
        console.log(`[FS] Created document upload directory: ${config.UPLOADS_DIR}`);
    }
    if (!fs.existsSync(config.AUDIOS_DIR)) {
        fs.mkdirSync(config.AUDIOS_DIR, { recursive: true });
        console.log(`[FS] Created audio cache directory: ${config.AUDIOS_DIR}`);
    }
}

/**
 * Retrieves the plain text content from the saved JSON sidecar file.
 * In dual mode, this returns the text from the text PDF (for TTS).
 * @param {string} docId - The ID prefix for the file.
 * @returns {Promise<string | null>} The document text or null if not found.
 */
async function getAITextByDocId(docId) {
    try {
        const jsonFilePath = path.join(config.UPLOADS_DIR, `${docId}.json`);
        try {
            await fsPromises.access(jsonFilePath);
            const content = await fsPromises.readFile(jsonFilePath, 'utf8');
            const data = JSON.parse(content);
            // Returns text from text PDF (for TTS) - always uses text PDF content
            return data.text || null;
        } catch (accessError) {
            if (accessError.code === 'ENOENT') {
                return null;
            }
            throw accessError;
        }
    } catch (error) {
        console.error(`[FS Error] Failed to read text for ID ${docId}:`, error.message);
        return null;
    }
}

/**
 * Gets document metadata by docId
 * Returns full metadata including dual PDF mode information:
 * - textFilename: "{docId}_text.pdf" (for TTS)
 * - visualFilename: "{docId}_visual.pdf" (for display and word counting)
 * - isDualMode: true/false
 * @param {string} docId - Document ID
 * @returns {Promise<Object | null>} Document metadata or null if not found
 */
async function getDocumentMetadata(docId) {
    try {
        const jsonFilePath = path.join(config.UPLOADS_DIR, `${docId}.json`);
        try {
            await fsPromises.access(jsonFilePath);
            const content = await fsPromises.readFile(jsonFilePath, 'utf8');
            return JSON.parse(content);
        } catch (accessError) {
            if (accessError.code === 'ENOENT') {
                return null;
            }
            throw accessError;
        }
    } catch (error) {
        console.error(`[FS Error] Failed to read metadata for ID ${docId}:`, error.message);
        return null;
    }
}

/**
 * Saves document metadata to JSON sidecar file.
 * @param {Object} sidecarData - Document metadata object
 * @returns {Promise<void>}
 */
async function saveDocumentMetadata(sidecarData) {
    const jsonFilePath = path.join(config.UPLOADS_DIR, `${sidecarData.id}.json`);
    await fsPromises.writeFile(jsonFilePath, JSON.stringify(sidecarData, null, 2), 'utf8');
}

/**
 * Gets all documents from the file system.
 * Returns metadata including dual PDF mode information.
 * @returns {Promise<Array>} Array of document metadata
 */
async function getAllDocuments() {
    try {
        const files = await fsPromises.readdir(config.UPLOADS_DIR);
        
        const documents = await Promise.all(
            files
                .filter(f => f.endsWith('.json'))
                .map(async (f) => {
                    try {
                        const jsonContent = await fsPromises.readFile(
                            path.join(config.UPLOADS_DIR, f),
                            'utf8'
                        );
                        const data = JSON.parse(jsonContent);
                        
                        // Build document info with dual PDF support
                        const docInfo = {
                            id: data.id,
                            title: data.title,
                            length: data.length,
                            filename: data.filename, // Visual PDF filename (for backward compatibility)
                            timestamp: data.timestamp,
                            courseName: data.courseName || data.title,
                            courseDescription: data.courseDescription || ''
                        };
                        
                        // Add dual PDF mode information if available
                        if (data.isDualMode) {
                            docInfo.isDualMode = true;
                            docInfo.textFilename = data.textFilename; // {docId}_text.pdf
                            docInfo.visualFilename = data.visualFilename; // {docId}_visual.pdf
                            docInfo.numPagesText = data.numPagesText;
                            docInfo.numPagesVisual = data.numPagesVisual;
                        } else {
                            docInfo.isDualMode = false;
                            // Legacy format: single PDF
                            // filename already contains the PDF filename
                        }
                        
                        return docInfo;
                    } catch (error) {
                        console.error(`[FS Error] Failed to read document ${f}:`, error.message);
                        return null;
                    }
                })
        );
        
        return documents.filter(doc => doc !== null);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Checks if an audio file exists (async).
 * @param {string} audioId - Audio file ID (without extension)
 * @returns {Promise<boolean>}
 */
async function audioFileExists(audioId) {
    const audioFilePath = path.join(config.AUDIOS_DIR, `${audioId}.wav`);
    try {
        await fsPromises.access(audioFilePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Checks if a file exists (async).
 * @param {string} filePath - Full file path
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
    try {
        await fsPromises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads an audio file.
 * @param {string} audioId - Audio file ID (without extension)
 * @returns {Promise<Buffer>}
 */
async function readAudioFile(audioId) {
    const audioFilePath = path.join(config.AUDIOS_DIR, `${audioId}.wav`);
    return await fsPromises.readFile(audioFilePath);
}

/**
 * Saves an audio file.
 * @param {string} audioId - Audio file ID (without extension)
 * @param {Buffer} audioBuffer - Audio file buffer
 * @returns {Promise<void>}
 */
async function saveAudioFile(audioId, audioBuffer) {
    const audioFilePath = path.join(config.AUDIOS_DIR, `${audioId}.wav`);
    await fsPromises.writeFile(audioFilePath, audioBuffer);
}

/**
 * Get absolute path to an audio file.
 * @param {string} audioId
 * @returns {string}
 */
function getAudioFilePath(audioId) {
    return path.join(config.AUDIOS_DIR, `${audioId}${constants.FILE_EXTENSIONS.WAV}`);
}

/**
 * Get absolute path to a lip sync JSON file.
 * @param {string} docId
 * @returns {string}
 */
function getLipSyncFilePath(docId) {
    return path.join(config.AUDIOS_DIR, `${docId}${constants.FILE_EXTENSIONS.JSON}`);
}

/**
 * Check if lipsync JSON exists
 * @param {string} docId
 * @returns {Promise<boolean>}
 */
async function lipSyncFileExists(docId) {
    const lipSyncPath = getLipSyncFilePath(docId);
    try {
        await fsPromises.access(lipSyncPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read lip sync JSON file.
 * @param {string} docId
 * @returns {Promise<Object|null>}
 */
async function readLipSyncFile(docId) {
    const lipSyncPath = getLipSyncFilePath(docId);
    try {
        await fsPromises.access(lipSyncPath);
        const content = await fsPromises.readFile(lipSyncPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

/**
 * Delete a document and all associated assets (PDFs, metadata, audio caches)
 * @param {string} docId - Document ID
 * @returns {Promise<boolean>} True if document existed and was removed, false if not found
 */
async function deleteDocumentAssets(docId) {
    const metadata = await getDocumentMetadata(docId);

    if (!metadata) {
        return false;
    }

    const filesToDelete = [
        path.join(config.UPLOADS_DIR, `${docId}${constants.FILE_EXTENSIONS.JSON}`)
    ];

    if (metadata.isDualMode && metadata.textFilename && metadata.visualFilename) {
        filesToDelete.push(
            path.join(config.UPLOADS_DIR, metadata.textFilename),
            path.join(config.UPLOADS_DIR, metadata.visualFilename)
        );
    } else {
        filesToDelete.push(path.join(config.UPLOADS_DIR, `${docId}${constants.FILE_EXTENSIONS.PDF}`));
    }

    const audioFiles = [
        path.join(config.AUDIOS_DIR, `${docId}${constants.FILE_EXTENSIONS.WAV}`),
        path.join(config.AUDIOS_DIR, `${docId}${constants.AUDIO_PREFIXES.SUMMARY}${constants.FILE_EXTENSIONS.WAV}`),
        getLipSyncFilePath(docId)
    ];

    const deleteFile = async (filePath) => {
        try {
            await fsPromises.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    };

    await Promise.all([...filesToDelete, ...audioFiles].map(deleteFile));
    return true;
}

module.exports = {
    setupDirectories,
    getAITextByDocId,
    getDocumentMetadata,
    saveDocumentMetadata,
    getAllDocuments,
    audioFileExists,
    fileExists,
    readAudioFile,
    saveAudioFile,
    getAudioFilePath,
    getLipSyncFilePath,
    lipSyncFileExists,
    readLipSyncFile,
    deleteDocumentAssets,
};

