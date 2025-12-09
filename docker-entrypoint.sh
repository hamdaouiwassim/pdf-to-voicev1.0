#!/bin/bash

echo "🚀 Starting Titan Academy API..."

# Optional: Wait for MySQL to be ready (commented out - uncomment if needed)
# Function to wait for MySQL
# wait_for_mysql() {
#     echo "⏳ Waiting for MySQL database to be ready..."
#     local max_attempts=30
#     local attempt=1
#     
#     while [ $attempt -le $max_attempts ]; do
#         if node -e "
#             require('dotenv').config();
#             const mysql = require('mysql2/promise');
#             const config = require('./config/config');
#             
#             mysql.createConnection({
#                 host: config.DB_HOST,
#                 port: config.DB_PORT,
#                 user: config.DB_USER,
#                 password: config.DB_PASSWORD || '',
#                 database: config.DB_NAME
#             }).then(conn => {
#                 conn.end();
#                 process.exit(0);
#             }).catch(err => {
#                 process.exit(1);
#             });
#         " 2>/dev/null; then
#             echo "✓ MySQL database is ready!"
#             return 0
#         fi
#         
#         echo "⏳ Attempt $attempt/$max_attempts: MySQL not ready yet, waiting 2 seconds..."
#         sleep 2
#         attempt=$((attempt + 1))
#     done
#     
#     echo "❌ Error: MySQL database did not become ready after $max_attempts attempts"
#     return 1
# }
# wait_for_mysql || echo "⚠️ Warning: Could not connect to MySQL. Continuing anyway..."

echo "🌐 Starting API server..."
echo "📝 Executing command: $@"
echo "📝 Working directory: $(pwd)"
echo "📝 Node version: $(node --version)"
echo "📝 NPM version: $(npm --version)"

# Start the application
echo "🚀 Executing: $@"
exec "$@"

