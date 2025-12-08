-- MySQL initialization script for titan_academy database
-- This script runs automatically when the MySQL container is first created

-- Create database if it doesn't exist (usually already created by MYSQL_DATABASE env var)
CREATE DATABASE IF NOT EXISTS titan_academy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE titan_academy;

-- Example: Create a users table (customize based on your needs)
-- Uncomment and modify as needed
/*
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;
*/

-- Example: Create a documents table (customize based on your needs)
-- Uncomment and modify as needed
/*
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    status ENUM('uploaded', 'processing', 'completed', 'failed') DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;
*/

-- Grant privileges to the application user
-- The user is created by MYSQL_USER environment variable, but we ensure it has proper permissions
GRANT ALL PRIVILEGES ON titan_academy.* TO 'app_user'@'%';
FLUSH PRIVILEGES;

-- Show databases (for verification)
SHOW DATABASES;
-- MySQL initialization script for document-reader database
-- This script runs automatically when the MySQL container is first created

-- Create database if it doesn't exist (usually already created by MYSQL_DATABASE env var)
CREATE DATABASE IF NOT EXISTS document_reader CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE document_reader;

-- Example: Create a users table (customize based on your needs)
-- Uncomment and modify as needed
/*
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
*/

-- Example: Create a documents table (customize based on your needs)
-- Uncomment and modify as needed
/*
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    status ENUM('uploaded', 'processing', 'completed', 'failed') DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
*/

-- Grant privileges to the application user
-- The user is created by MYSQL_USER environment variable, but we ensure it has proper permissions
GRANT ALL PRIVILEGES ON document_reader.* TO 'app_user'@'%';
FLUSH PRIVILEGES;

-- Show databases (for verification)
SHOW DATABASES;

