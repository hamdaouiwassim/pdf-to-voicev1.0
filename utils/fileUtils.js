const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('../config/config');

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
 * @param {string} docId - The ID prefix for the file.
 * @returns {Promise<string | null>} The document text or null if not found.
 */
async function getAITextByDocId(docId) {
    try {
        const jsonFilePath = path.join(config.UPLOADS_DIR, `${docId}.json`);
        if (fs.existsSync(jsonFilePath)) {
            const content = await fsPromises.readFile(jsonFilePath, 'utf8');
            return JSON.parse(content).text;
        }
        return null;
    } catch (error) {
        console.error(`[FS Error] Failed to read text for ID ${docId}:`, error.message);
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
                        return {
                            id: data.id,
                            title: data.title,
                            length: data.length,
                            filename: data.filename
                        };
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
 * Checks if an audio file exists.
 * @param {string} audioId - Audio file ID (without extension)
 * @returns {boolean}
 */
function audioFileExists(audioId) {
    const audioFilePath = path.join(config.AUDIOS_DIR, `${audioId}.wav`);
    return fs.existsSync(audioFilePath);
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

module.exports = {
    setupDirectories,
    getAITextByDocId,
    saveDocumentMetadata,
    getAllDocuments,
    audioFileExists,
    readAudioFile,
    saveAudioFile,
};

