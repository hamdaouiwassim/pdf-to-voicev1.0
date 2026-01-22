/**
 * Quick fix script to alter quiz_questions table to support multiple-choice questions
 * Run this if you get "Column 'correct_answer_index' cannot be null" error
 * 
 * Usage: node scripts/fix-quiz-schema.js
 */

require('dotenv').config();
const db = require('../config/database');

async function fixQuizSchema() {
    try {
        console.log('Fixing quiz_questions table schema...');

        // Modify correct_answer_index to allow NULL
        await db.query(`
            ALTER TABLE quiz_questions 
            MODIFY COLUMN correct_answer_index INT NULL
        `);
        console.log('✓ Modified correct_answer_index to allow NULL');

        // Add question_type column if it doesn't exist
        try {
            await db.query(`
                ALTER TABLE quiz_questions 
                ADD COLUMN question_type ENUM('single', 'multiple') DEFAULT 'single' AFTER options
            `);
            console.log('✓ Added question_type column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('✓ question_type column already exists');
            } else {
                throw error;
            }
        }

        // Add correct_answer_indices column if it doesn't exist
        try {
            await db.query(`
                ALTER TABLE quiz_questions 
                ADD COLUMN correct_answer_indices JSON NULL AFTER correct_answer_index
            `);
            console.log('✓ Added correct_answer_indices column');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('✓ correct_answer_indices column already exists');
            } else {
                throw error;
            }
        }

        // Update existing questions to ensure they have question_type set
        await db.query(`
            UPDATE quiz_questions 
            SET question_type = 'single' 
            WHERE question_type IS NULL
        `);
        console.log('✓ Updated existing questions with question_type');

        // Add index for question_type if it doesn't exist
        try {
            await db.query(`
                CREATE INDEX idx_question_type ON quiz_questions(question_type)
            `);
            console.log('✓ Added index for question_type');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('✓ Index idx_question_type already exists');
            } else {
                throw error;
            }
        }

        console.log('\n✅ Quiz schema fixed successfully!');
        console.log('You can now create both single-choice and multiple-choice questions.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing quiz schema:', error);
        process.exit(1);
    }
}

// Run the fix
fixQuizSchema();
