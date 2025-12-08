const mysql = require('mysql2/promise');
const config = require('./config');

// Create connection pool for better performance
const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: config.DB_CONNECTION_LIMIT || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✓ MySQL database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('✗ MySQL database connection failed:', error.message);
        return false;
    }
}

// Execute a query
async function query(sql, params) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Get a connection from the pool (for transactions)
async function getConnection() {
    return await pool.getConnection();
}

// Close all connections (useful for graceful shutdown)
async function closePool() {
    try {
        await pool.end();
        console.log('MySQL connection pool closed');
    } catch (error) {
        console.error('Error closing MySQL pool:', error);
    }
}

module.exports = {
    pool,
    query,
    getConnection,
    testConnection,
    closePool
};

