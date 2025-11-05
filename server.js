const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const config = require('./config/config');
const fileUtils = require('./utils/fileUtils');
const errorHandler = require('./middleware/errorHandler');

// Import controllers (for backward compatibility)
const documentController = require('./controllers/documentController');

// Import routes
const documentRoutes = require('./routes/documentRoutes');
const ttsRoutes = require('./routes/ttsRoutes');
const qaRoutes = require('./routes/qaRoutes');
const audioRoutes = require('./routes/audioRoutes');

// Initialize Express app
const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(config.UPLOADS_DIR));
app.use('/audios', express.static(config.AUDIOS_DIR));
app.use(fileUpload());

// --- API Routes ---
// Maintain backward compatibility for /api/extract-text
app.use('/api/documents', documentRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/audio', audioRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: require('./package.json').version
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// --- Start Server ---
fileUtils.setupDirectories(); // Ensure directories exist before starting

app.listen(config.PORT, () => {
    try {
        console.log(`Server is running at http://localhost:${config.PORT}`);
        const keyDisplay = config.GEMINI_API_KEY ? `${config.GEMINI_API_KEY.substring(0, 4)}...` : 'NOT SET';
        console.log(`API Key: ${keyDisplay} (Set via .env file or GEMINI_API_KEY)`);
        console.log(`Uploads Directory: ${config.UPLOADS_DIR}`);
        console.log(`Audio Directory: ${config.AUDIOS_DIR}`);
        console.log("-----------------------------------------");
        console.log("NOTE: Open index.html in your browser.");
    } catch (error) {
        console.error("Server startup error:", error);
    }
});
