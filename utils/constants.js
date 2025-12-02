/**
 * Application-wide constants
 */
module.exports = {
    FILE_EXTENSIONS: {
        PDF: '.pdf',
        JSON: '.json',
        WAV: '.wav'
    },
    
    AUDIO_PREFIXES: {
        SUMMARY: '-summary',
        QA: 'qa-',
        LAB: 'lab-'
    },
    
    ERROR_MESSAGES: {
        NO_FILE: 'No PDF file uploaded',
        INVALID_FILE_TYPE: 'Only PDF files are allowed',
        FILE_TOO_LARGE: 'File size exceeds the maximum limit',
        DOC_NOT_FOUND: 'Document not found',
        DOC_ID_REQUIRED: 'Document ID is required',
        INVALID_DOC_ID: 'Invalid document ID',
        QUESTION_REQUIRED: 'Valid question is required'
    },
    
    SUCCESS_MESSAGES: {
        DOC_SAVED: 'Document saved successfully',
        SUMMARY_GENERATED: 'Summary generated successfully'
    }
};

