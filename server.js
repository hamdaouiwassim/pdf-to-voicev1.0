console.log('=========================================');
console.log('📦 Starting server.js...');
console.log('📦 Loading server dependencies...');

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const path = require('path');

console.log('📦 Loading configuration...');
let config;
try {
    config = require('./config/config');
    console.log('✓ Configuration loaded successfully');
} catch (error) {
    console.error('❌ FATAL: Failed to load configuration:', error.message);
    console.error('❌ Error stack:', error.stack);
    process.exit(1);
}

const fileUtils = require('./utils/fileUtils');
const errorHandler = require('./middleware/errorHandler');
const db = require('./config/database');
const { requireAuth } = require('./middleware/auth');

// Import controllers (for backward compatibility)
const documentController = require('./controllers/documentController');

// Import centralized routes
const apiRoutes = require('./routes');

// Initialize Express app
const app = express();

// --- Middleware ---
// Configure CORS with explicit options
// When credentials are included, origin cannot be '*', must be specific origin(s)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://102.211.209.131:4080', 'http://localhost:4080', 'http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // In development, allow any origin (for testing)
            if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'development') {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
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
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // Allow cross-site requests with credentials
    },
    name: 'titan.academy.sid' // Custom session cookie name
}));

app.use(express.json());

// Protect index.html and users.html - redirect to login if not authenticated
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/users.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

app.get('/labs.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'labs.html'));
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
    // Set CORS headers (use origin from request if in allowed list)
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

// Add CORS headers and inline disposition to static file serving
app.use('/uploads', setInlineHeaders, express.static(config.UPLOADS_DIR));
app.use('/audios', (req, res, next) => {
    // Set CORS headers (use origin from request if in allowed list)
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
}, express.static(config.AUDIOS_DIR));
// File upload middleware - configured for all routes
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for all uploads
    abortOnLimit: true,
    createParentPath: true // Automatically create parent directories
}));

// --- API Routes ---
// Use centralized routing system
// All routes are organized in routes/index.js
app.use('/api', apiRoutes);

// Log registered routes
console.log('✓ API Routes registered via centralized routing system');
console.log('  - Public: /api/auth, /api/documents, /api/tts, /api/qa, /api/audio, /api/lab');
console.log('  - Protected: /api/subscriptions, /api/courses, /api/labs, /api/exercises, /api/users');
console.log('  - Health: /api/health');

// Error handling middleware (must be last)
app.use(errorHandler);

// --- Start Server ---
fileUtils.setupDirectories(); // Ensure directories exist before starting

// Initialize database connection
async function startServer() {
    console.log('🚀 Starting server initialization...');
    // Test database connection (optional - won't fail if DB is not configured)
    if (config.DB_HOST && config.DB_NAME) {
        try {
            const connected = await db.testConnection();
            if (!connected) {
                console.warn('⚠ Database connection test failed, but continuing server startup...');
            }
        } catch (error) {
            console.warn('⚠ Database connection test error, but continuing server startup:', error.message);
        }
    } else {
        console.log('⚠ MySQL database not configured (DB_HOST/DB_NAME not set)');
    }

    // Start the server regardless of database connection status
    try {
        const server = app.listen(config.PORT, '0.0.0.0', () => {
            try {
                console.log(`✓ Server is running at http://0.0.0.0:${config.PORT}`);
                console.log(`✓ Server is accessible at http://localhost:${config.PORT}`);
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

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${config.PORT} is already in use. Please use a different port.`);
            } else {
                console.error('❌ Server error:', error);
            }
            process.exit(1);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        throw error;
    }
}

// Start the server
startServer().catch(error => {
    console.error("Failed to start server:", error);
    console.error("Error stack:", error.stack);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Error stack:', error.stack);
    // Don't exit immediately, let the server try to start
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, let the server try to start
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
