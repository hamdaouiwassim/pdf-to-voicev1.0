/**
 * Authentication Middleware
 * Protects routes that require authentication
 */

function requireAuth(req, res, next) {
    // Check if user is authenticated via session
    if (req.session && req.session.authenticated) {
        return next();
    }

    // For API requests, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
            error: 'Authentication required',
            message: 'Please login to access this resource'
        });
    }

    // For HTML pages, redirect to login
    return res.redirect('/login.html');
}

/**
 * Optional auth check - doesn't block, just sets req.isAuthenticated
 */
function optionalAuth(req, res, next) {
    req.isAuthenticated = req.session && req.session.authenticated === true;
    next();
}

module.exports = {
    requireAuth,
    optionalAuth
};

