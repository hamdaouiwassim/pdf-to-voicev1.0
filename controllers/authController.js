const config = require('../config/config');

// Admin credentials from environment or defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@titanacademy.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Login endpoint
 * POST /api/auth/login
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({ 
                error: 'Email is required' 
            });
        }

        if (!password) {
            return res.status(400).json({ 
                error: 'Password is required' 
            });
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format' 
            });
        }

        // Normalize email (lowercase)
        const normalizedEmail = email.toLowerCase().trim();

        // Validate credentials
        if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
            // Create session
            req.session.authenticated = true;
            req.session.email = normalizedEmail;
            req.session.loginTime = new Date().toISOString();
            
            // Set session expiration (24 hours)
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000;

            return res.json({
                success: true,
                message: 'Login successful',
                authenticated: true,
                email: normalizedEmail
            });
        } else {
            return res.status(401).json({ 
                error: 'Invalid email or password',
                authenticated: false
            });
        }
    } catch (error) {
        console.error("[Auth Login Error]:", error);
        res.status(500).json({
            error: 'Login failed',
            details: error.message
        });
    }
}

/**
 * Logout endpoint
 * POST /api/auth/logout
 */
async function logout(req, res) {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error("[Auth Logout Error]:", err);
                return res.status(500).json({ 
                    error: 'Logout failed',
                    details: err.message
                });
            }

            res.clearCookie('connect.sid'); // Clear session cookie
            return res.json({
                success: true,
                message: 'Logout successful'
            });
        });
    } catch (error) {
        console.error("[Auth Logout Error]:", error);
        res.status(500).json({
            error: 'Logout failed',
            details: error.message
        });
    }
}

/**
 * Check authentication status
 * GET /api/auth/status
 */
async function getAuthStatus(req, res) {
    try {
        const isAuthenticated = req.session && req.session.authenticated === true;
        
        res.json({
            authenticated: isAuthenticated,
            email: req.session?.email || null,
            loginTime: req.session?.loginTime || null
        });
    } catch (error) {
        console.error("[Auth Status Error]:", error);
        res.status(500).json({
            error: 'Failed to check authentication status',
            details: error.message
        });
    }
}

module.exports = {
    login,
    logout,
    getAuthStatus
};

