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
const labRoutes = require('./routes/labRoutes');

// Initialize Express app
const app = express();

// --- Middleware ---
// Configure CORS with explicit options
// The cors() middleware automatically handles OPTIONS preflight requests
app.use(cors({
    origin: '*', // Allow all origins (can be restricted in production)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

app.use(express.json());
app.use(express.static('public'));

// Middleware to set inline Content-Disposition for PDF files (prevents download prompt on Android)
const setInlineHeaders = (req, res, next) => {
    // Check if the request is for a PDF file
    if (req.path.toLowerCase().endsWith('.pdf')) {
        // Set Content-Disposition to inline to force browser to display, not download
        res.setHeader('Content-Disposition', 'inline; filename="' + req.path.split('/').pop() + '"');
        res.setHeader('Content-Type', 'application/pdf');
    }
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

// Add CORS headers and inline disposition to static file serving
app.use('/uploads', setInlineHeaders, express.static(config.UPLOADS_DIR));
app.use('/audios', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
}, express.static(config.AUDIOS_DIR));
app.use(fileUpload());

// --- API Routes ---
// Maintain backward compatibility for /api/extract-text
app.use('/api/documents', documentRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/lab', labRoutes);

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
