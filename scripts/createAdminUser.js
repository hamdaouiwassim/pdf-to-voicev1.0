/**
 * Script to create an admin user in the database
 * Run with: node scripts/createAdminUser.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/database');

async function createAdminUser() {
    try {
        // Get admin credentials from environment or use defaults
        const email = process.env.ADMIN_EMAIL || 'admin@titanacademy.com';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const name = process.env.ADMIN_NAME || 'Administrator';

        console.log('Creating admin user...');
        console.log(`Email: ${email}`);

        // Check if user already exists
        const existingUsers = await db.query(
            'SELECT id, email FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUsers.length > 0) {
            console.log(`User with email ${email} already exists.`);
            console.log('Updating password...');
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Update existing user
            await db.query(
                'UPDATE users SET password = ?, name = ?, role = "admin", is_active = TRUE WHERE email = ?',
                [hashedPassword, name, email.toLowerCase()]
            );
            
            console.log('✓ Admin user password updated successfully!');
        } else {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Create new admin user
            await db.query(
                'INSERT INTO users (email, password, name, role, is_active) VALUES (?, ?, ?, "admin", TRUE)',
                [email.toLowerCase(), hashedPassword, name]
            );
            
            console.log('✓ Admin user created successfully!');
        }

        console.log('\nAdmin credentials:');
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${password}`);
        console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
}

// Run the script
createAdminUser().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

