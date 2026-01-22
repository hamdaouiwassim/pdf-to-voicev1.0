const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const constants = require('./constants');

/**
 * Ensures all necessary directories exist on server startup.
 * Media layout: media/{courseId}/uploads|audios|json, media/_global/uploads|audios
 */
function setupDirectories() {
    if (!fs.existsSync(config.MEDIA_DIR)) {
        fs.mkdirSync(config.MEDIA_DIR, { recursive: true });
        console.log(`[FS] Created media directory: ${config.MEDIA_DIR}`);
    }
    if (!fs.existsSync(config.UPLOADS_DIR)) {
        fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });
        console.log(`[FS] Created global uploads directory: ${config.UPLOADS_DIR}`);
    }
    if (!fs.existsSync(config.AUDIOS_DIR)) {
        fs.mkdirSync(config.AUDIOS_DIR, { recursive: true });
        console.log(`[FS] Created global audios directory: ${config.AUDIOS_DIR}`);
    }
}

/**
 * Get media directory path for a course
 * @param {string} courseId - Course ID
 * @returns {string} Path to course media directory
 */
function getCourseMediaDir(courseId) {
    return path.join(config.MEDIA_DIR, courseId);
}

/**
 * Get uploads directory path for a course (base for courses subtree)
 * media/{courseId}/uploads/courses
 * @param {string} courseId - Course ID
 * @returns {string} Path to course uploads directory
 */
function getCourseUploadsDir(courseId) {
    return path.join(getCourseMediaDir(courseId), 'uploads', 'courses');
}

/**
 * Get course-level uploads directory (course image, chapter subdirs)
 * media/{courseId}/uploads/courses/{courseId}
 * @param {string} courseId - Course ID
 * @returns {string} Path to course-level uploads directory
 */
function getCourseUploadsCourseDir(courseId) {
    return path.join(getCourseUploadsDir(courseId), courseId);
}

/**
 * Get chapter uploads directory path
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {string} Path to chapter uploads directory
 */
function getChapterUploadsDir(courseId, chapterId) {
    return path.join(getCourseUploadsDir(courseId), courseId, chapterId);
}

/**
 * Get final-projects directory for a course
 * media/{courseId}/uploads/final-projects
 * @param {string} courseId - Course ID
 * @returns {string}
 */
function getCourseFinalProjectsDir(courseId) {
    return path.join(getCourseMediaDir(courseId), 'uploads', 'final-projects');
}

/**
 * Get final project directory
 * media/{courseId}/uploads/final-projects/{projectId}
 * @param {string} courseId - Course ID
 * @param {string} projectId - Project ID
 * @returns {string}
 */
function getFinalProjectDir(courseId, projectId) {
    return path.join(getCourseFinalProjectsDir(courseId), projectId);
}

/**
 * Get labs directory for a course
 * media/{courseId}/uploads/labs
 * @param {string} courseId - Course ID
 * @returns {string}
 */
function getCourseLabsDir(courseId) {
    return path.join(getCourseMediaDir(courseId), 'uploads', 'labs');
}

/**
 * Get lab directory
 * media/{courseId}/uploads/labs/{labId}
 * @param {string} courseId - Course ID
 * @param {string} labId - Lab ID
 * @returns {string}
 */
function getLabDir(courseId, labId) {
    return path.join(getCourseLabsDir(courseId), labId);
}

/**
 * Get audios directory path for a course
 * @param {string} courseId - Course ID
 * @returns {string} Path to course audios directory
 */
function getCourseAudiosDir(courseId) {
    return path.join(getCourseMediaDir(courseId), 'audios');
}

/**
 * Get chapter audios directory path
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {string} Path to chapter audios directory
 */
function getChapterAudiosDir(courseId, chapterId) {
    return path.join(getCourseAudiosDir(courseId), 'chapters', chapterId);
}

/**
 * Get JSON directory path for a course
 * @param {string} courseId - Course ID
 * @returns {string} Path to course JSON directory
 */
function getCourseJsonDir(courseId) {
    return path.join(getCourseMediaDir(courseId), 'json');
}

/**
 * Get chapter JSON directory path
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {string} Path to chapter JSON directory
 */
function getChapterJsonDir(courseId, chapterId) {
    return path.join(getCourseJsonDir(courseId), 'chapters', chapterId);
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
                            courseDescription: data.courseDescription || '',
                            hasStatements: Array.isArray(data.statements) && data.statements.length > 0,
                            statementsCount: Array.isArray(data.statements) ? data.statements.length : 0
                        };
                        
                        // Add dual PDF mode information if available
                        if (data.isDualMode) {
                            docInfo.isDualMode = true;
                            docInfo.textFilename = data.textFilename; // {docId}_text.pdf
                            docInfo.visualFilename = data.visualFilename; // {docId}_visual.pdf
                            docInfo.numPagesText = data.numPagesText;
                            docInfo.numPagesVisual = data.numPagesVisual;
                            docInfo.numPagesStatements = data.numPagesStatements || 0;
                            docInfo.statementsFilename = data.statementsFilename || null;
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
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @param {string} audioType - Type of audio: 'chapters', 'quiz', 'qa', 'lab' (optional)
 * @returns {Promise<boolean>}
 */
async function audioFileExists(audioId, courseId = null, audioType = null) {
    const audioFilePath = getAudioFilePath(audioId, courseId, audioType);
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
 * @param {string} [courseId] - Course ID (optional, for course-based structure)
 * @param {string} [audioType] - Type: 'chapters', 'quiz', 'qa', 'lab' (optional)
 * @returns {Promise<Buffer>}
 */
async function readAudioFile(audioId, courseId = null, audioType = null) {
    const audioFilePath = (courseId && audioType)
        ? getAudioFilePath(audioId, courseId, audioType)
        : path.join(config.AUDIOS_DIR, `${audioId}.wav`);
    return await fsPromises.readFile(audioFilePath);
}

/**
 * Saves an audio file.
 * @param {string} audioId - Audio file ID (without extension)
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} [courseId] - Course ID (optional, for course-based structure)
 * @param {string} [audioType] - Type: 'chapters', 'quiz', 'qa', 'lab' (optional)
 * @returns {Promise<void>}
 */
async function saveAudioFile(audioId, audioBuffer, courseId = null, audioType = null) {
    const audioFilePath = (courseId && audioType)
        ? getAudioFilePath(audioId, courseId, audioType)
        : path.join(config.AUDIOS_DIR, `${audioId}.wav`);
    await fsPromises.mkdir(path.dirname(audioFilePath), { recursive: true });
    await fsPromises.writeFile(audioFilePath, audioBuffer);
}

/**
 * Get absolute path to an audio file.
 * @param {string} audioId - Audio ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @param {string} audioType - Type of audio: 'chapters', 'quiz', 'qa', 'lab' (optional)
 * @returns {string}
 */
function getAudioFilePath(audioId, courseId = null, audioType = null) {
    // If courseId is provided, use new structure
    if (courseId && audioType) {
        const audioSubDir = audioType;
        return path.join(getCourseAudiosDir(courseId), audioSubDir, `${audioId}${constants.FILE_EXTENSIONS.WAV}`);
    }
    // Legacy path for backward compatibility
    return path.join(config.AUDIOS_DIR, `${audioId}${constants.FILE_EXTENSIONS.WAV}`);
}

/**
 * Get absolute path to a chapter audio file (main or summary)
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID
 * @param {string} type - 'main' or 'summary' (default: 'main')
 * @returns {string}
 */
function getChapterAudioFilePath(chapterId, courseId, type = 'main') {
    const audioDir = getChapterAudiosDir(courseId, chapterId);
    const filename = type === 'summary' 
        ? `${chapterId}-summary${constants.FILE_EXTENSIONS.WAV}`
        : `${chapterId}${constants.FILE_EXTENSIONS.WAV}`;
    return path.join(audioDir, filename);
}

/**
 * Save chapter main or summary audio (media layout)
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID
 * @param {string} type - 'main' or 'summary'
 * @param {Buffer} audioBuffer - WAV buffer
 * @returns {Promise<void>}
 */
async function saveChapterAudio(chapterId, courseId, type, audioBuffer) {
    const audioPath = getChapterAudioFilePath(chapterId, courseId, type);
    await fsPromises.mkdir(path.dirname(audioPath), { recursive: true });
    await fsPromises.writeFile(audioPath, audioBuffer);
}

/**
 * Read chapter main or summary audio
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID
 * @param {string} type - 'main' or 'summary'
 * @returns {Promise<Buffer>}
 */
async function readChapterAudio(chapterId, courseId, type) {
    const audioPath = getChapterAudioFilePath(chapterId, courseId, type);
    return await fsPromises.readFile(audioPath);
}

/**
 * Get directory path for page-based audio files (for chapters)
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {string} Directory path
 */
function getPageAudioDir(chapterId, courseId = null) {
    // If courseId is provided, use new structure
    if (courseId) {
        return path.join(getChapterAudiosDir(courseId, chapterId), 'pages');
    }
    // Legacy path for backward compatibility
    return path.join(config.AUDIOS_DIR, chapterId);
}

/**
 * Get absolute path to a page audio file
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {string} Full path to audio file
 */
function getPageAudioFilePath(chapterId, pageNumber, courseId = null) {
    const pageDir = getPageAudioDir(chapterId, courseId);
    const pageNumStr = String(pageNumber).padStart(2, '0'); // 01, 02, 03, etc.
    return path.join(pageDir, `page_${pageNumStr}.wav`);
}

/**
 * Get directory path for page-based lip sync JSON files (for chapters)
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {string} Directory path
 */
function getPageLipSyncDir(chapterId, courseId = null) {
    if (courseId) {
        return path.join(getChapterJsonDir(courseId, chapterId), 'pages');
    }
    return path.join(config.AUDIOS_DIR, chapterId);
}

/**
 * Get absolute path to a page lip sync JSON file
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {string} Full path to lip sync JSON file
 */
function getPageLipSyncFilePath(chapterId, pageNumber, courseId = null) {
    const pageDir = getPageLipSyncDir(chapterId, courseId);
    const pageNumStr = String(pageNumber).padStart(2, '0'); // 01, 02, 03, etc.
    return path.join(pageDir, `page_${pageNumStr}.json`);
}

/**
 * Check if a page lip sync JSON file exists
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<boolean>}
 */
async function pageLipSyncFileExists(chapterId, pageNumber, courseId = null) {
    const lipSyncPath = getPageLipSyncFilePath(chapterId, pageNumber, courseId);
    return await fileExists(lipSyncPath);
}

/**
 * Read a page lip sync JSON file
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<Object>}
 */
async function readPageLipSyncFile(chapterId, pageNumber, courseId = null) {
    const lipSyncPath = getPageLipSyncFilePath(chapterId, pageNumber, courseId);
    const content = await fsPromises.readFile(lipSyncPath, 'utf8');
    return JSON.parse(content);
}

/**
 * Check if a page audio file exists
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<boolean>}
 */
async function pageAudioFileExists(chapterId, pageNumber, courseId = null) {
    const audioPath = getPageAudioFilePath(chapterId, pageNumber, courseId);
    return await fileExists(audioPath);
}

/**
 * Read a page audio file
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<Buffer>}
 */
async function readPageAudioFile(chapterId, pageNumber, courseId = null) {
    const audioPath = getPageAudioFilePath(chapterId, pageNumber, courseId);
    return await fsPromises.readFile(audioPath);
}

/**
 * Save a page audio file
 * @param {string} chapterId - Chapter ID
 * @param {number} pageNumber - Page number (1-indexed)
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<void>}
 */
async function savePageAudioFile(chapterId, pageNumber, audioBuffer, courseId = null) {
    const pageDir = getPageAudioDir(chapterId, courseId);
    // Ensure directory exists
    await fsPromises.mkdir(pageDir, { recursive: true });
    
    const audioPath = getPageAudioFilePath(chapterId, pageNumber, courseId);
    await fsPromises.writeFile(audioPath, audioBuffer);
}

/**
 * Get duration of an audio file (WAV format)
 * @param {Buffer} audioBuffer - WAV file buffer
 * @returns {Promise<number>} Duration in seconds
 */
async function getAudioDuration(audioBuffer) {
    // WAV file format: bytes 4-7 contain file size, bytes 24-27 contain sample rate
    // bytes 28-31 contain byte rate, bytes 32-35 contain block align
    // bytes 40-43 contain data chunk size
    
    // Simple calculation: data size / (sample rate * channels * bits per sample / 8)
    // For standard WAV: sample rate is at offset 24, channels at 22, bits per sample at 34
    
    try {
        const sampleRate = audioBuffer.readUInt32LE(24);
        const numChannels = audioBuffer.readUInt16LE(22);
        const bitsPerSample = audioBuffer.readUInt16LE(34);
        const dataSize = audioBuffer.readUInt32LE(40);
        
        const bytesPerSample = (bitsPerSample / 8) * numChannels;
        const duration = dataSize / (sampleRate * bytesPerSample);
        
        return Math.round(duration * 10) / 10; // Round to 1 decimal
    } catch (error) {
        console.warn('[Audio Duration] Failed to calculate duration, using fallback:', error.message);
        // Fallback: estimate based on file size (rough estimate)
        // Assume 16-bit mono 24kHz: ~48KB per second
        return Math.round((audioBuffer.length / 48000) * 10) / 10;
    }
}

/**
 * Get absolute path to a lip sync JSON file.
 * @param {string} docId
 * @returns {string}
 */
/**
 * Get absolute path to a lip sync JSON file
 * @param {string} docId - Document/Chapter ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @param {string} type - Type: 'chapter', 'quiz', 'qa' (optional)
 * @returns {string}
 */
function getLipSyncFilePath(docId, courseId = null, type = null) {
    // If courseId is provided, use new structure
    if (courseId && type) {
        const jsonSubDir = type === 'chapter' ? 'chapters' : type;
        return path.join(getCourseJsonDir(courseId), jsonSubDir, `${docId}${constants.FILE_EXTENSIONS.JSON}`);
    }
    // Legacy path for backward compatibility
    return path.join(config.AUDIOS_DIR, `${docId}${constants.FILE_EXTENSIONS.JSON}`);
}

/**
 * Check if lipsync JSON exists
 * @param {string} docId - Document/Chapter ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @param {string} type - Type: 'chapter', 'quiz', 'qa' (optional)
 * @returns {Promise<boolean>}
 */
async function lipSyncFileExists(docId, courseId = null, type = null) {
    const lipSyncPath = getLipSyncFilePath(docId, courseId, type);
    try {
        await fsPromises.access(lipSyncPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read lip sync JSON file.
 * @param {string} docId - Document/Chapter/Audio ID
 * @param {string} [courseId] - Course ID (optional, for course-based structure)
 * @param {string} [type] - Type: 'chapter', 'quiz', 'qa' (optional)
 * @returns {Promise<Object|null>}
 */
async function readLipSyncFile(docId, courseId = null, type = null) {
    const lipSyncPath = getLipSyncFilePath(docId, courseId, type);
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

/**
 * Course Management Functions
 */

/**
 * Get course metadata by courseId
 * @param {string} courseId - Course ID
 * @returns {Promise<Object | null>} Course metadata or null if not found
 */
async function getCourseMetadata(courseId) {
    try {
        // Try new structure first
        const newCoursesDir = getCourseUploadsDir(courseId);
        const newJsonFilePath = path.join(newCoursesDir, `${courseId}.json`);
        
        try {
            await fsPromises.access(newJsonFilePath);
            const content = await fsPromises.readFile(newJsonFilePath, 'utf8');
            return JSON.parse(content);
        } catch {
            // Fallback to legacy structure
        }
        
        // Legacy structure
        const coursesDir = path.join(config.UPLOADS_DIR, 'courses');
        const jsonFilePath = path.join(coursesDir, `${courseId}.json`);
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
        console.error(`[FS Error] Failed to read course metadata for ID ${courseId}:`, error.message);
        return null;
    }
}

/**
 * Save course metadata
 * @param {Object} courseData - Course metadata object
 * @returns {Promise<void>}
 */
async function saveCourseMetadata(courseData) {
    // Use new structure
    const coursesDir = getCourseUploadsDir(courseData.id);
    await fsPromises.mkdir(coursesDir, { recursive: true });
    const jsonFilePath = path.join(coursesDir, `${courseData.id}.json`);
    await fsPromises.writeFile(jsonFilePath, JSON.stringify(courseData, null, 2), 'utf8');
}

/**
 * Get all courses (from media layout and legacy uploads/courses)
 * @returns {Promise<Array>} Array of course metadata
 */
async function getAllCourses() {
    const results = [];
    try {
        // Media: scan media/{courseId}, skip _global
        if (fs.existsSync(config.MEDIA_DIR)) {
            const entries = await fsPromises.readdir(config.MEDIA_DIR, { withFileTypes: true });
            for (const e of entries) {
                if (!e.isDirectory() || e.name === '_global') continue;
                const courseId = e.name;
                try {
                    const course = await getCourseMetadata(courseId);
                    if (course) {
                        results.push({
                            id: course.id,
                            courseName: course.courseName,
                            courseDescription: course.courseDescription,
                            chaptersCount: Array.isArray(course.chapters) ? course.chapters.length : 0,
                            createdAt: course.createdAt,
                            updatedAt: course.updatedAt
                        });
                    }
                } catch (err) {
                    console.warn(`[FS] Skip course ${courseId}:`, err.message);
                }
            }
        }
        // Legacy: uploads/courses/*.json
        const legacyDir = path.join(config.UPLOADS_DIR, 'courses');
        if (fs.existsSync(legacyDir)) {
            const files = await fsPromises.readdir(legacyDir);
            for (const f of files) {
                if (!f.endsWith('.json')) continue;
                const courseId = f.replace(/\.json$/, '');
                if (results.some(c => c.id === courseId)) continue;
                try {
                    const content = await fsPromises.readFile(path.join(legacyDir, f), 'utf8');
                    const data = JSON.parse(content);
                    results.push({
                        id: data.id,
                        courseName: data.courseName,
                        courseDescription: data.courseDescription,
                        chaptersCount: Array.isArray(data.chapters) ? data.chapters.length : 0,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt
                    });
                } catch (error) {
                    console.warn(`[FS] Failed to read legacy course ${f}:`, error.message);
                }
            }
        }
        return results;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Delete a course and all its chapters
 * @param {string} courseId - Course ID
 * @returns {Promise<boolean>} True if course existed and was removed, false if not found
 */
async function deleteCourseAssets(courseId) {
    const course = await getCourseMetadata(courseId);
    if (!course) {
        return false;
    }

    // Delete all chapters (media paths)
    if (Array.isArray(course.chapters)) {
        for (const chapterRef of course.chapters) {
            await deleteChapterAssets(courseId, chapterRef.id);
        }
    }

    // Delete entire course media directory
    const courseMediaDir = getCourseMediaDir(courseId);
    try {
        if (await fileExists(courseMediaDir)) {
            await fsPromises.rm(courseMediaDir, { recursive: true, force: true });
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    // Legacy: remove uploads/courses/{courseId} and uploads/courses/{courseId}.json
    const legacyCourseDir = path.join(config.UPLOADS_DIR, 'courses', courseId);
    const legacyJsonPath = path.join(config.UPLOADS_DIR, 'courses', `${courseId}.json`);
    try {
        if (await fileExists(legacyCourseDir)) {
            await fsPromises.rm(legacyCourseDir, { recursive: true, force: true });
        }
        if (await fileExists(legacyJsonPath)) {
            await fsPromises.unlink(legacyJsonPath);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    return true;
}

/**
 * Chapter Management Functions
 */

/**
 * Get chapter metadata
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Object | null>} Chapter metadata or null if not found
 */
async function getChapterMetadata(courseId, chapterId) {
    try {
        // Media structure first
        const chapterDir = getChapterUploadsDir(courseId, chapterId);
        const jsonFilePath = path.join(chapterDir, `${chapterId}.json`);
        try {
            await fsPromises.access(jsonFilePath);
            const content = await fsPromises.readFile(jsonFilePath, 'utf8');
            return JSON.parse(content);
        } catch {
            // Legacy: uploads/courses/{courseId}/{chapterId}
        }
        const legacyDir = path.join(config.UPLOADS_DIR, 'courses', courseId, chapterId);
        const legacyPath = path.join(legacyDir, `${chapterId}.json`);
        try {
            await fsPromises.access(legacyPath);
            const content = await fsPromises.readFile(legacyPath, 'utf8');
            return JSON.parse(content);
        } catch (accessError) {
            if (accessError.code === 'ENOENT') {
                return null;
            }
            throw accessError;
        }
    } catch (error) {
        console.error(`[FS Error] Failed to read chapter metadata for ID ${chapterId}:`, error.message);
        return null;
    }
}

/**
 * Save chapter metadata
 * @param {Object} chapterData - Chapter metadata object
 * @returns {Promise<void>}
 */
async function saveChapterMetadata(chapterData) {
    // Use new structure
    const chapterDir = getChapterUploadsDir(chapterData.courseId, chapterData.id);
    await fsPromises.mkdir(chapterDir, { recursive: true });
    const jsonFilePath = path.join(chapterDir, `${chapterData.id}.json`);
    await fsPromises.writeFile(jsonFilePath, JSON.stringify(chapterData, null, 2), 'utf8');
}

/**
 * Get chapter text content
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<string | null>} Chapter text or null if not found
 */
async function getChapterText(chapterId) {
    try {
        const courseList = await getAllCourses();
        for (const c of courseList) {
            const course = await getCourseMetadata(c.id);
            if (!course || !Array.isArray(course.chapters)) continue;
            const chapterRef = course.chapters.find(ch => ch.id === chapterId);
            if (!chapterRef) continue;
            const chapter = await getChapterMetadata(course.id, chapterId);
            if (chapter && chapter.text) return chapter.text;
        }
        return null;
    } catch (error) {
        console.error(`[FS Error] Failed to read chapter text for ID ${chapterId}:`, error.message);
        return null;
    }
}

/**
 * Delete a chapter and all its assets
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<boolean>} True if chapter existed and was removed, false if not found
 */
async function deleteChapterAssets(courseId, chapterId) {
    const chapter = await getChapterMetadata(courseId, chapterId);
    if (!chapter) {
        return false;
    }

    const chapterDir = getChapterUploadsDir(courseId, chapterId);

    // Delete chapter directory (includes PDFs, WebP images, metadata JSON)
    try {
        if (await fileExists(chapterDir)) {
            await fsPromises.rm(chapterDir, { recursive: true, force: true });
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    // Delete audio and lip-sync (media + legacy)
    await deleteChapterAudioFiles(chapterId, courseId);
    await deleteChapterLipSyncFile(chapterId, courseId);

    const legacyAudioFiles = [
        path.join(config.AUDIOS_DIR, `${chapterId}${constants.FILE_EXTENSIONS.WAV}`),
        path.join(config.AUDIOS_DIR, `${chapterId}${constants.AUDIO_PREFIXES.SUMMARY}${constants.FILE_EXTENSIONS.WAV}`),
        getLipSyncFilePath(chapterId)
    ];
    for (const fp of legacyAudioFiles) {
        try {
            if (await fileExists(fp)) await fsPromises.unlink(fp);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }
    }

    // Legacy chapter dir
    const legacyChapterDir = path.join(config.UPLOADS_DIR, 'courses', courseId, chapterId);
    try {
        if (await fileExists(legacyChapterDir)) {
            await fsPromises.rm(legacyChapterDir, { recursive: true, force: true });
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    // Remove chapter from course
    const course = await getCourseMetadata(courseId);
    if (course && Array.isArray(course.chapters)) {
        course.chapters = course.chapters.filter(ch => ch.id !== chapterId);
        course.updatedAt = new Date().toISOString();
        await saveCourseMetadata(course);
    }

    return true;
}

/**
 * Delete chapter audio files (main audio and page audios)
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<{deleted: string[], errors: string[]}>} List of deleted files and errors
 */
async function deleteChapterAudioFiles(chapterId, courseId = null) {
    const deleted = [];
    const errors = [];

    // Delete main chapter audio (try both new and legacy structures)
    if (courseId) {
        // New structure
        const mainAudioPath = getChapterAudioFilePath(chapterId, courseId, 'main');
        const summaryAudioPath = getChapterAudioFilePath(chapterId, courseId, 'summary');
        
        try {
            if (await fileExists(mainAudioPath)) {
                await fsPromises.unlink(mainAudioPath);
                deleted.push('main_audio');
            }
        } catch (error) {
            errors.push(`main_audio: ${error.message}`);
        }
        
        try {
            if (await fileExists(summaryAudioPath)) {
                await fsPromises.unlink(summaryAudioPath);
                deleted.push('summary_audio');
            }
        } catch (error) {
            errors.push(`summary_audio: ${error.message}`);
        }
    } else {
        // Legacy structure
        const mainAudioPath = getAudioFilePath(chapterId);
        try {
            if (await fileExists(mainAudioPath)) {
                await fsPromises.unlink(mainAudioPath);
                deleted.push('main_audio');
            }
        } catch (error) {
            errors.push(`main_audio: ${error.message}`);
        }
    }

    // Delete page audio directory
    const pageAudioDir = getPageAudioDir(chapterId, courseId);
    try {
        if (await fileExists(pageAudioDir)) {
            await fsPromises.rm(pageAudioDir, { recursive: true, force: true });
            deleted.push('page_audios');
        }
    } catch (error) {
        errors.push(`page_audios: ${error.message}`);
    }

    return { deleted, errors };
}

/**
 * Delete chapter lipsync file
 * @param {string} chapterId - Chapter ID
 * @param {string} courseId - Course ID (optional, for course-based structure)
 * @returns {Promise<{deleted: boolean, error: string|null}>}
 */
async function deleteChapterLipSyncFile(chapterId, courseId = null) {
    // Try new structure first, then legacy
    let lipSyncPath = null;
    if (courseId) {
        lipSyncPath = getLipSyncFilePath(chapterId, courseId, 'chapter');
    } else {
        lipSyncPath = getLipSyncFilePath(chapterId);
    }

    let deleted = false;
    let error = null;

    try {
        if (await fileExists(lipSyncPath)) {
            await fsPromises.unlink(lipSyncPath);
            deleted = true;
        }
    } catch (err) {
        error = err.message;
    }

    if (courseId) {
        const pageLipSyncDir = getPageLipSyncDir(chapterId, courseId);
        try {
            if (await fileExists(pageLipSyncDir)) {
                await fsPromises.rm(pageLipSyncDir, { recursive: true, force: true });
                deleted = true;
            }
        } catch (err) {
            error = error ? `${error}; ${err.message}` : err.message;
        }
    }

    return { deleted, error };
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
    // Course functions
    getCourseMetadata,
    saveCourseMetadata,
    getAllCourses,
    deleteCourseAssets,
    // Chapter functions
    getChapterMetadata,
    saveChapterMetadata,
    getChapterText,
    deleteChapterAssets,
    // Page audio functions
    getPageAudioDir,
    getPageAudioFilePath,
    pageAudioFileExists,
    readPageAudioFile,
    savePageAudioFile,
    getPageLipSyncDir,
    getPageLipSyncFilePath,
    pageLipSyncFileExists,
    readPageLipSyncFile,
    getAudioDuration,
    // Chapter regeneration functions
    deleteChapterAudioFiles,
    deleteChapterLipSyncFile,
    // New course-based structure functions
    getCourseMediaDir,
    getCourseUploadsDir,
    getCourseUploadsCourseDir,
    getChapterUploadsDir,
    getCourseFinalProjectsDir,
    getFinalProjectDir,
    getCourseLabsDir,
    getLabDir,
    getCourseAudiosDir,
    getChapterAudiosDir,
    getCourseJsonDir,
    getChapterJsonDir,
    getChapterAudioFilePath,
    saveChapterAudio,
    readChapterAudio,
};

