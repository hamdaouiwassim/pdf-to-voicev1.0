const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
    // Server Configuration
    PORT: process.env.PORT || 3000,
    
    // API Configuration
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_FLASH_MODEL: 'gemini-2.5-flash-preview-09-2025',
    GEMINI_TTS_MODEL: 'gemini-2.5-flash-preview-tts',
    
    // Directories
    UPLOADS_DIR: path.join(__dirname, '..', 'uploads'),
    AUDIOS_DIR: path.join(__dirname, '..', 'audios'),
    
    // Audio Parameters
    SAMPLE_RATE: 24000,
    CHANNELS: 1,
    BITS_PER_SAMPLE: 16,
    
    // File Upload Limits
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024, // 10MB
    ALLOWED_MIME_TYPES: ['application/pdf'],
    
    // TTS Configuration
    TTS_TEXT_LIMIT: process.env.TTS_TEXT_LIMIT || 4000,
    TTS_VOICE_DOCUMENT: 'Kore',
    TTS_VOICE_QA: 'Zephyr',

    // Lip Sync / Rhubarb configuration
    RHUBARB_PATH: process.env.RHUBARB_PATH || path.join(__dirname, '..', 'bin', 'Rhubarb-Lip-Sync-1.14.0', process.platform === 'win32' ? 'rhubarb.exe' : 'rhubarb'),
};

// Validate required configuration
if (!config.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
    console.error("Please ensure your .env file is correct.");
    process.exit(1);
}

// Calculate derived audio constants
config.BLOCK_ALIGN = (config.CHANNELS * config.BITS_PER_SAMPLE) / 8;
config.BYTE_RATE = config.SAMPLE_RATE * config.BLOCK_ALIGN;

// Generate API URLs
config.GEMINI_TEXT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_FLASH_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
config.GEMINI_TTS_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_TTS_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

module.exports = config;

