const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
    // Server Configuration
    PORT: process.env.PORT || 3000,
    
    // Database Configuration
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 3306,
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_NAME: process.env.DB_NAME || 'titan_academy',
    DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    
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

    // Lab Space / Python Execution defaults
    PYTHON_BINARIES: (process.env.PYTHON_BINARIES || 'python,py').split(',').map((value) => value.trim()).filter(Boolean),
    PYTHON_TIMEOUT_MS: parseInt(process.env.PYTHON_TIMEOUT_MS || '8000', 10),
    PYTHON_MAX_CODE_LENGTH: parseInt(process.env.PYTHON_MAX_CODE_LENGTH || '4000', 10),
    PYTHON_MAX_STDIO_LENGTH: parseInt(process.env.PYTHON_MAX_STDIO_LENGTH || '20000', 10),
    LAB_TTS_LANGUAGE: process.env.LAB_TTS_LANGUAGE || 'fr-FR',
    LAB_FEEDBACK_LANGUAGE: process.env.LAB_FEEDBACK_LANGUAGE || 'fr',

    // Lip Sync / Rhubarb configuration
    RHUBARB_PATH: (() => {
        // Check environment variable first
        if (process.env.RHUBARB_PATH) {
            return process.env.RHUBARB_PATH;
        }
        const isWindows = process.platform === 'win32';
        const executableName = isWindows ? 'rhubarb.exe' : 'rhubarb';
        
        // Check local libsync folder (api/libsync/rhubarb)
        const localLibsyncPath = path.join(__dirname, '..', 'libsync', executableName);
        if (fs.existsSync(localLibsyncPath)) {
            return localLibsyncPath;
        }
        
        // Check production Docker volume path (prioritize platform-appropriate executable)
        const dockerVolumeBase = '/var/lib/docker/volumes/rhubarb-lip-sync';
        const possiblePaths = [
            // Check build directory first (where compiled executables are typically located)
            path.join(dockerVolumeBase, 'build', executableName),
            path.join(dockerVolumeBase, 'build', 'Release', executableName),
            path.join(dockerVolumeBase, 'build', 'Debug', executableName),
            // Check root of volume
            path.join(dockerVolumeBase, executableName),
            // Check _data subdirectory
            path.join(dockerVolumeBase, '_data', executableName),
            // Then check the other platform's executable (for cross-platform setups)
            path.join(dockerVolumeBase, 'build', isWindows ? 'rhubarb' : 'rhubarb.exe'),
            path.join(dockerVolumeBase, isWindows ? 'rhubarb' : 'rhubarb.exe'),
            path.join(dockerVolumeBase, '_data', isWindows ? 'rhubarb' : 'rhubarb.exe'),
        ];
        for (const dockerPath of possiblePaths) {
            if (fs.existsSync(dockerPath)) {
                return dockerPath;
            }
        }
        // Fallback to local bin directory
        return path.join(__dirname, '..', 'bin', 'Rhubarb-Lip-Sync-1.14.0', process.platform === 'win32' ? 'rhubarb.exe' : 'rhubarb');
    })(),
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

