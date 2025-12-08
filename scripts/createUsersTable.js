/**
 * Script to create users table if it doesn't exist
 * Run with: node scripts/createUsersTable.js
 * 
 * This is safe to run multiple times - it won't drop existing data
 */

require('dotenv').config();
const db = require('../config/database');

async function createUsersTable() {
    try {
        console.log('Checking if users table exists...');

        // Check if table exists
        const tables = await db.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'",
            [process.env.DB_NAME || 'titan_academy']
        );

        if (tables.length > 0) {
            console.log('✓ Users table already exists.');
            
            // Show table structure
            const structure = await db.query('DESCRIBE users');
            console.log('\nTable structure:');
            console.table(structure);
            
            // Count existing users
            const userCount = await db.query('SELECT COUNT(*) as count FROM users');
            console.log(`\nTotal users: ${userCount[0].count}`);
            
            return;
        }

        console.log('Users table not found. Creating...');

        // Create users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                role ENUM('admin', 'user') DEFAULT 'user',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                INDEX idx_email (email),
                INDEX idx_role (role),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✓ Users table created successfully!');
        console.log('\nYou can now create an admin user with: npm run create-admin');

        process.exit(0);
    } catch (error) {
        console.error('Error creating users table:', error);
        process.exit(1);
    }
}

// Run the script
createUsersTable().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

