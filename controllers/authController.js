const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const { sendPasswordResetEmail } = require('../services/emailService');

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

            res.clearCookie('titan.academy.sid'); // Clear session cookie
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
 * Register endpoint - Create new user account
 * POST /api/auth/register
 */
async function register(req, res) {
    try {
        const { email, password, name } = req.body;

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

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters long' 
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

        // Check if user already exists
        const existingUsers = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ 
                error: 'User with this email already exists' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (default role is 'user')
        const result = await db.query(
            `INSERT INTO users (email, password, name, role, is_active)
             VALUES (?, ?, ?, 'user', TRUE)`,
            [
                normalizedEmail,
                hashedPassword,
                name || null
            ]
        );

        // Get created user
        const newUser = await db.query(
            `SELECT 
                id,
                email,
                name,
                role,
                is_active,
                created_at
             FROM users
             WHERE id = ?`,
            [result.insertId]
        );

        console.log(`[Auth] User registered successfully: ${newUser[0].id} - ${newUser[0].email}`);

        // Automatically log in the new user
        req.session.authenticated = true;
        req.session.userId = newUser[0].id;
        req.session.email = newUser[0].email;
        req.session.name = newUser[0].name;
        req.session.role = newUser[0].role;
        req.session.loginTime = new Date().toISOString();
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            authenticated: true,
            email: newUser[0].email,
            name: newUser[0].name,
            role: newUser[0].role
        });
    } catch (error) {
        console.error("[Auth Register Error]:", error);
        res.status(500).json({
            error: 'Registration failed',
            details: error.message
        });
    }
}

/**
 * Forgot password endpoint - Request a reset link
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'Email is required'
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const users = await db.query(
            'SELECT id, email, is_active FROM users WHERE email = ? AND is_active = TRUE',
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.json({
                success: true,
                message: 'If an account exists, a reset email has been sent.'
            });
        }

        const user = users[0];
        const resetToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await db.query(
            `INSERT INTO password_resets (user_id, token_hash, expires_at, request_ip, user_agent)
             VALUES (?, ?, ?, ?, ?)`,
            [
                user.id,
                tokenHash,
                expiresAt,
                req.ip || null,
                req.get('user-agent') || null
            ]
        );

        try {
            await sendPasswordResetEmail(user.email, resetToken);
        } catch (mailError) {
            console.error("[Auth Forgot Password Email Error]:", mailError);
            return res.status(500).json({
                error: 'Failed to send reset email'
            });
        }

        return res.json({
            success: true,
            message: 'If an account exists, a reset email has been sent.'
        });
    } catch (error) {
        console.error("[Auth Forgot Password Error]:", error);
        res.status(500).json({
            error: 'Forgot password request failed',
            details: error.message
        });
    }
}

/**
 * Reset password endpoint - Update password using reset token
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res) {
    let connection;
    try {
        connection = await db.getConnection();
        const { token, password } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const resetRows = await connection.query(
            `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.is_active
             FROM password_resets pr
             JOIN users u ON u.id = pr.user_id
             WHERE pr.token_hash = ?
             LIMIT 1`,
            [tokenHash]
        );

        const resetRecord = resetRows[0]?.[0];

        if (!resetRecord || resetRecord.used_at || new Date(resetRecord.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        if (!resetRecord.is_active) {
            return res.status(403).json({ error: 'User account is inactive' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await connection.beginTransaction();
        await connection.query(
            'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
            [hashedPassword, resetRecord.user_id]
        );
        await connection.query(
            'UPDATE password_resets SET used_at = NOW() WHERE id = ?',
            [resetRecord.id]
        );
        await connection.commit();

        return res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error("[Auth Reset Password Error]:", error);
        res.status(500).json({
            error: 'Password reset failed',
            details: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
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
    register,
    forgotPassword,
    resetPassword,
    logout,
    getAuthStatus
};

