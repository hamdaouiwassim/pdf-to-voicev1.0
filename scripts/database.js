/**
 * Unified database setup and management script
 * 
 * This script combines all database-related operations:
 * - Create all database tables (courses, chapters, subscriptions, etc.)
 * - Create users table
 * - Create admin user
 * 
 * Usage:
 *   node scripts/database.js [command]
 * 
 * Commands:
 *   tables    - Create all database tables (default)
 *   users     - Create users table only
 *   admin     - Create admin user
 *   all       - Run all operations (tables, users, admin)
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/database');

/**
 * Create users table if it doesn't exist
 */
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
            
            return true;
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
        return true;
    } catch (error) {
        console.error('Error creating users table:', error);
        throw error;
    }
}

/**
 * Create all database tables (courses, chapters, subscriptions, etc.)
 */
async function createTables() {
    try {
        console.log('Creating database tables...');

        // Create courses table
        await db.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id VARCHAR(36) PRIMARY KEY,
                course_name VARCHAR(255) NOT NULL,
                course_description TEXT,
                course_image VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_course_name (course_name),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Courses table created/verified');

        // Create chapters table
        await db.query(`
            CREATE TABLE IF NOT EXISTS chapters (
                id VARCHAR(36) PRIMARY KEY,
                course_id VARCHAR(36) NOT NULL,
                chapter_name VARCHAR(255) NOT NULL,
                chapter_description TEXT,
                video_link VARCHAR(500),
                text_content LONGTEXT,
                text_filename VARCHAR(255),
                visual_filename VARCHAR(255),
                statements_filename VARCHAR(255),
                text_length INT DEFAULT 0,
                num_pages_text INT DEFAULT 0,
                num_pages_visual INT DEFAULT 0,
                num_pages_statements INT DEFAULT 0,
                statements_count INT DEFAULT 0,
                statements JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                INDEX idx_course_id (course_id),
                INDEX idx_chapter_name (chapter_name),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Chapters table created/verified');

        // Create chapter_images table
        await db.query(`
            CREATE TABLE IF NOT EXISTS chapter_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chapter_id VARCHAR(36) NOT NULL,
                image_path VARCHAR(500) NOT NULL,
                page_number INT,
                image_type ENUM('webp', 'jpg', 'png') DEFAULT 'webp',
                file_size BIGINT,
                width INT,
                height INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
                INDEX idx_chapter_id (chapter_id),
                INDEX idx_page_number (page_number),
                INDEX idx_image_type (image_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Chapter images table created/verified');

        // Create subscriptions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) DEFAULT 0.00,
                duration_days INT NOT NULL DEFAULT 30,
                is_active BOOLEAN DEFAULT TRUE,
                features JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_is_active (is_active),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Subscriptions table created/verified');

        // Create subscription_courses table
        await db.query(`
            CREATE TABLE IF NOT EXISTS subscription_courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                subscription_id INT NOT NULL,
                course_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                UNIQUE KEY unique_subscription_course (subscription_id, course_id),
                INDEX idx_subscription_id (subscription_id),
                INDEX idx_course_id (course_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Subscription courses table created/verified');

        // Create user_subscriptions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subscription_id INT NOT NULL,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_subscription_id (subscription_id),
                INDEX idx_end_date (end_date),
                INDEX idx_is_active (is_active),
                INDEX idx_user_active (user_id, is_active, end_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ User subscriptions table created/verified');

        // Create course_enrollments table
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_enrollments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id VARCHAR(36) NOT NULL,
                subscription_id INT,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
                UNIQUE KEY unique_user_course (user_id, course_id),
                INDEX idx_user_id (user_id),
                INDEX idx_course_id (course_id),
                INDEX idx_subscription_id (subscription_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Course enrollments table created/verified');

        // Create labs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS labs (
                id VARCHAR(36) PRIMARY KEY,
                course_id VARCHAR(36) NOT NULL,
                lab_name VARCHAR(255) NOT NULL,
                lab_description TEXT,
                lab_type VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                INDEX idx_course_id (course_id),
                INDEX idx_lab_name (lab_name),
                INDEX idx_lab_type (lab_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Labs table created/verified');

        // Create exercises table
        await db.query(`
            CREATE TABLE IF NOT EXISTS exercises (
                id VARCHAR(36) PRIMARY KEY,
                lab_id VARCHAR(36) NOT NULL,
                exercise_name VARCHAR(255) NOT NULL,
                exercise_description TEXT,
                pdf_resource VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
                INDEX idx_lab_id (lab_id),
                INDEX idx_exercise_name (exercise_name),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Exercises table created/verified');

        // Verify tables
        const tables = await db.query('SHOW TABLES');
        console.log('\n✓ All tables created successfully!');
        console.log('\nTables in database:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`  - ${tableName}`);
        });

        return true;
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}

/**
 * Create an admin user in the database
 */
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
        
        return true;
    } catch (error) {
        console.error('Error creating admin user:', error);
        throw error;
    }
}

/**
 * Main function to run commands
 */
async function main() {
    const command = process.argv[2] || 'tables';

    try {
        switch (command.toLowerCase()) {
            case 'tables':
                await createTables();
                break;
            
            case 'users':
                await createUsersTable();
                break;
            
            case 'admin':
                await createAdminUser();
                break;
            
            case 'all':
                console.log('Running all database setup operations...\n');
                await createUsersTable();
                console.log('');
                await createTables();
                console.log('');
                await createAdminUser();
                break;
            
            default:
                console.log('Usage: node scripts/database.js [command]');
                console.log('\nCommands:');
                console.log('  tables  - Create all database tables (default)');
                console.log('  users   - Create users table only');
                console.log('  admin   - Create admin user');
                console.log('  all     - Run all operations (tables, users, admin)');
                process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

// Export functions for use in other scripts if needed
module.exports = {
    createUsersTable,
    createTables,
    createAdminUser
};

