-- Migration script to add course_image column to courses table
-- Date: 2025-12-16
-- Description: Adds course_image column to store course image filenames
-- 
-- Run this manually if the column doesn't exist:
-- Usage: docker compose exec mysql mysql -u app_user -papp_password titan_academy < docker/mysql/migrations/migration-2025-12-16.sql
-- Or: mysql -u app_user -papp_password titan_academy < docker/mysql/migrations/migration-2025-12-16.sql

USE titan_academy;

-- Check if course_image column exists, and add it if it doesn't
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'courses'
      AND COLUMN_NAME = 'course_image'
);

-- Add course_image column only if it doesn't exist
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE courses ADD COLUMN course_image VARCHAR(500) AFTER course_description',
    'SELECT "Column course_image already exists. Skipping migration." AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify column exists
DESCRIBE courses;

-- Show current courses table structure
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'courses'
ORDER BY ORDINAL_POSITION;

