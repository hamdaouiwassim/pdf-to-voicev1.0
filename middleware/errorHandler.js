/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, next) {
    console.error('[Error]', err);

    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            details: err.details 
        })
    });
}

module.exports = errorHandler;

