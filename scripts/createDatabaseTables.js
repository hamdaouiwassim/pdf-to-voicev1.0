/**
 * Script to create database tables for courses, chapters, and images
 * Run with: node scripts/createDatabaseTables.js
 * 
 * This is safe to run multiple times - it won't drop existing data
 */

require('dotenv').config();
const db = require('../config/database');

async function createTables() {
    try {
        console.log('Creating database tables...');

        // Create courses table
        await db.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id VARCHAR(36) PRIMARY KEY,
                course_name VARCHAR(255) NOT NULL,
                course_description TEXT,
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

        // Verify tables
        const tables = await db.query('SHOW TABLES');
        console.log('\n✓ All tables created successfully!');
        console.log('\nTables in database:');
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`  - ${tableName}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error creating tables:', error);
        process.exit(1);
    }
}

// Run the script
createTables().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

