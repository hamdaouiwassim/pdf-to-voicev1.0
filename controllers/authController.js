const bcrypt = require('bcrypt');
const db = require('../config/database');

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

        // Query user from database
        const users = await db.query(
            'SELECT id, email, password, name, role, is_active FROM users WHERE email = ? AND is_active = TRUE',
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid email or password',
                authenticated: false
            });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ 
                error: 'Invalid email or password',
                authenticated: false
            });
        }

        // Update last login timestamp
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Create session
        req.session.authenticated = true;
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.name = user.name;
        req.session.role = user.role;
        req.session.loginTime = new Date().toISOString();
        
        // Set session expiration (24 hours)
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;

        return res.json({
            success: true,
            message: 'Login successful',
            authenticated: true,
            email: user.email,
            name: user.name,
            role: user.role
        });
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
            name: req.session?.name || null,
            role: req.session?.role || null,
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

