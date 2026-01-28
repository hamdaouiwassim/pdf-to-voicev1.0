const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// POST /api/auth/register - Register new user
router.post('/register', authController.register);

// POST /api/auth/login - Login
router.post('/login', authController.login);

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password - Reset password
router.post('/reset-password', authController.resetPassword);

// POST /api/auth/logout - Logout (requires authentication)
router.post('/logout', requireAuth, authController.logout);

// GET /api/auth/status - Check authentication status
router.get('/status', authController.getAuthStatus);

module.exports = router;

