/**
 * Validate file upload middleware
 */
function validateFileUpload(req, res, next) {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files were uploaded' });
    }
    next();
}

/**
 * Validate document creation request
 */
function validateDocumentRequest(req, res, next) {
    const { title, text } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Valid title is required' });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Valid text is required' });
    }

    next();
}

/**
 * Validate question request
 */
function validateQuestionRequest(req, res, next) {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Valid question is required' });
    }

    next();
}

module.exports = {
    validateFileUpload,
    validateDocumentRequest,
    validateQuestionRequest,
};

