const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const path = require('path');
const config = require('./config/config');
const fileUtils = require('./utils/fileUtils');
const errorHandler = require('./middleware/errorHandler');
const db = require('./config/database');
const { requireAuth } = require('./middleware/auth');

// Import controllers (for backward compatibility)
const documentController = require('./controllers/documentController');

// Import routes
const documentRoutes = require('./routes/documentRoutes');
const ttsRoutes = require('./routes/ttsRoutes');
const qaRoutes = require('./routes/qaRoutes');
const audioRoutes = require('./routes/audioRoutes');
const labRoutes = require('./routes/labRoutes');
const courseRoutes = require('./routes/courseRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

// Initialize Express app
const app = express();

// --- Middleware ---
// Configure CORS with explicit options
// The cors() middleware automatically handles OPTIONS preflight requests
app.use(cors({
    origin: '*', // Allow all origins (can be restricted in production)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Enable credentials for session cookies
}));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'titan-academy-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'titan.academy.sid' // Custom session cookie name
}));

app.use(express.json());

// Protect index.html - redirect to login if not authenticated
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (login.html is public, index.html is protected above)
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
// Authentication routes (public)
app.use('/api/auth', authRoutes);

// Maintain backward compatibility for /api/extract-text
app.use('/api/documents', documentRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/lab', labRoutes);

// Course and Chapter routes (protected)
app.use('/api/courses', requireAuth, courseRoutes);
app.use('/api/courses/:courseId/chapters', requireAuth, chapterRoutes);

// User management routes (protected)
app.use('/api/users', requireAuth, userRoutes);

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

// Initialize database connection
async function startServer() {
    // Test database connection (optional - won't fail if DB is not configured)
    if (config.DB_HOST && config.DB_NAME) {
        await db.testConnection();
    } else {
        console.log('⚠ MySQL database not configured (DB_HOST/DB_NAME not set)');
    }

    app.listen(config.PORT, () => {
    try {
        console.log(`Server is running at http://localhost:${config.PORT}`);
        const keyDisplay = config.GEMINI_API_KEY ? `${config.GEMINI_API_KEY.substring(0, 4)}...` : 'NOT SET';
        console.log(`API Key: ${keyDisplay} (Set via .env file or GEMINI_API_KEY)`);
        console.log(`Uploads Directory: ${config.UPLOADS_DIR}`);
        console.log(`Audio Directory: ${config.AUDIOS_DIR}`);
        console.log(`Platform: ${process.platform}`);
        
        // Check if Poppler utilities are available (for PDF to WebP conversion)
        const { execSync } = require('child_process');
        try {
            execSync('pdftocairo -v', { stdio: 'ignore' });
            console.log('✓ Poppler utilities are available');
        } catch (error) {
            console.warn('⚠ Poppler utilities not found - PDF to WebP conversion may fail');
            console.warn('  Install with: apt-get install poppler-utils (Debian/Ubuntu)');
        }
        
        console.log("-----------------------------------------");
        console.log("NOTE: Open index.html in your browser.");
    } catch (error) {
        console.error("Server startup error:", error);
    }
    });
}

// Start the server
startServer().catch(error => {
    console.error("Failed to start server:", error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await db.closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await db.closePool();
    process.exit(0);
});
