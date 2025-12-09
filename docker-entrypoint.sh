#!/bin/bash

echo "🚀 Starting Titan Academy API..."

# Function to wait for MySQL
wait_for_mysql() {
    echo "⏳ Waiting for MySQL database to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if node -e "
            require('dotenv').config();
            const mysql = require('mysql2/promise');
            const config = require('./config/config');
            
            mysql.createConnection({
                host: config.DB_HOST,
                port: config.DB_PORT,
                user: config.DB_USER,
                password: config.DB_PASSWORD || '',
                database: config.DB_NAME
            }).then(conn => {
                conn.end();
                process.exit(0);
            }).catch(err => {
                process.exit(1);
            });
        " 2>/dev/null; then
            echo "✓ MySQL database is ready!"
            return 0
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts: MySQL not ready yet, waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Error: MySQL database did not become ready after $max_attempts attempts"
    return 1
}

# Wait for MySQL to be ready
wait_for_mysql || {
    echo "⚠️ Warning: Could not connect to MySQL. Continuing anyway..."
    echo "⚠️ Database initialization scripts will be skipped."
    echo "🌐 Starting API server (you may need to run scripts manually)..."
    exec "$@"
    exit 0
}

# Run users table creation script
echo "📋 Creating users table..."
node scripts/createUsersTable.js
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Users table script completed successfully (exit code: $EXIT_CODE)"
elif [ $EXIT_CODE -eq 1 ]; then
    echo "⚠️ Warning: Users table creation had an error (exit code: $EXIT_CODE)"
else
    echo "⚠️ Warning: Users table creation exited with code $EXIT_CODE"
fi
echo "📋 Continuing after users table script..."

# Run database table creation script
echo "📊 Creating database tables..."
node scripts/createDatabaseTables.js
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Database tables script completed successfully (exit code: $EXIT_CODE)"
elif [ $EXIT_CODE -eq 1 ]; then
    echo "⚠️ Warning: Database tables creation had an error (exit code: $EXIT_CODE)"
else
    echo "⚠️ Warning: Database tables creation exited with code $EXIT_CODE"
fi
echo "📊 Continuing after database tables script..."

# Run admin user creation script
echo "👤 Creating admin user..."
node scripts/createAdminUser.js
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Admin user script completed successfully (exit code: $EXIT_CODE)"
elif [ $EXIT_CODE -eq 1 ]; then
    echo "⚠️ Warning: Admin user creation had an error (exit code: $EXIT_CODE)"
else
    echo "⚠️ Warning: Admin user creation exited with code $EXIT_CODE"
fi
echo "👤 Continuing after admin user script..."

echo "✅ Initialization complete!"
echo "🌐 Starting API server..."
echo "📝 Executing command: $@"
echo "📝 Working directory: $(pwd)"
echo "📝 Node version: $(node --version)"
echo "📝 NPM version: $(npm --version)"

# Start the application
echo "🚀 Executing: $@"
exec "$@"

