const config = require('../config/config');
const constants = require('../utils/constants');

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean}
 */
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate file upload middleware
 */
function validateFileUpload(req, res, next) {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.NO_FILE });
    }

    if (!req.files.pdfFile) {
        return res.status(400).json({ error: 'PDF file is required. Use field name "pdfFile".' });
    }

    // Validate file type
    if (!config.ALLOWED_MIME_TYPES.includes(req.files.pdfFile.mimetype)) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.INVALID_FILE_TYPE });
    }

    // Validate file size
    if (req.files.pdfFile.size > config.MAX_FILE_SIZE) {
        return res.status(400).json({ 
            error: `${constants.ERROR_MESSAGES.FILE_TOO_LARGE} (${config.MAX_FILE_SIZE / 1024 / 1024}MB)` 
        });
    }

    // Validate file extension
    const fileName = req.files.pdfFile.name || '';
    if (!fileName.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'File must have .pdf extension' });
    }

    next();
}

/**
 * Validate document creation request (for text-based document creation)
 */
function validateDocumentRequest(req, res, next) {
    const { title, text } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Valid title is required' });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Valid text is required' });
    }

    // Validate length constraints
    if (title.length > 500) {
        return res.status(400).json({ error: 'Title must be less than 500 characters' });
    }

    if (text.length > 1000000) { // 1MB of text
        return res.status(400).json({ error: 'Text content is too large (max 1MB)' });
    }

    next();
}

/**
 * Validate question request
 */
function validateQuestionRequest(req, res, next) {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.QUESTION_REQUIRED });
    }

    // Validate question length
    if (question.trim().length < 3) {
        return res.status(400).json({ error: 'Question must be at least 3 characters long' });
    }

    if (question.trim().length > 1000) {
        return res.status(400).json({ error: 'Question must be less than 1000 characters' });
    }

    next();
}

/**
 * Validate document ID parameter
 */
function validateDocId(req, res, next) {
    const { docId } = req.params;

    if (!docId) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.DOC_ID_REQUIRED });
    }

    // Security: Prevent directory traversal
    if (docId.includes('..') || docId.includes('/') || docId.includes('\\')) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.INVALID_DOC_ID });
    }

    // Validate UUID format (optional - can be more lenient for flexibility)
    // Only validate if it looks like a UUID
    if (docId.includes('-') && !isValidUUID(docId)) {
        return res.status(400).json({ error: 'Invalid document ID format' });
    }

    next();
}

/**
 * Validate document ID in request body
 */
function validateDocIdInBody(req, res, next) {
    const { docId } = req.body;

    if (!docId) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.DOC_ID_REQUIRED });
    }

    if (typeof docId !== 'string' || docId.trim().length === 0) {
        return res.status(400).json({ error: 'Document ID must be a non-empty string' });
    }

    // Security: Prevent directory traversal
    if (docId.includes('..') || docId.includes('/') || docId.includes('\\')) {
        return res.status(400).json({ error: constants.ERROR_MESSAGES.INVALID_DOC_ID });
    }

    next();
}

/**
 * Validate audio ID parameter
 */
function validateAudioId(req, res, next) {
    const { audioId } = req.params;

    if (!audioId) {
        return res.status(400).json({ error: 'Audio ID is required' });
    }

    // Security: Prevent directory traversal
    if (audioId.includes('..') || audioId.includes('/') || audioId.includes('\\')) {
        return res.status(400).json({ error: 'Invalid audio ID' });
    }

    // Validate length (reasonable limit)
    if (audioId.length > 200) {
        return res.status(400).json({ error: 'Audio ID is too long' });
    }

    next();
}

/**
 * Validate language query parameter (optional)
 */
function validateLanguage(req, res, next) {
    const { language } = req.query;

    if (language && typeof language === 'string') {
        const validLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt'];
        const langCode = language.toLowerCase().split('-')[0]; // Extract base language code
        
        if (!validLanguages.includes(langCode)) {
            return res.status(400).json({ 
                error: `Invalid language. Supported languages: ${validLanguages.join(', ')}` 
            });
        }
    }

    next();
}

/**
 * Validate useFreeAI parameter (optional boolean)
 */
function validateUseFreeAI(req, res, next) {
    const { useFreeAI } = req.body;

    if (useFreeAI !== undefined && typeof useFreeAI !== 'boolean') {
        return res.status(400).json({ error: 'useFreeAI must be a boolean value' });
    }

    next();
}

module.exports = {
    validateFileUpload,
    validateDocumentRequest,
    validateQuestionRequest,
    validateDocId,
    validateDocIdInBody,
    validateAudioId,
    validateLanguage,
    validateUseFreeAI,
};

