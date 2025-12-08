-- MySQL initialization script for titan_academy database
-- This script runs automatically when the MySQL container is first created

-- Create database if it doesn't exist (usually already created by MYSQL_DATABASE env var)
CREATE DATABASE IF NOT EXISTS titan_academy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE titan_academy;

-- Create users table for authentication
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grant privileges to the application user
-- The user is created by MYSQL_USER environment variable, but we ensure it has proper permissions
GRANT ALL PRIVILEGES ON titan_academy.* TO 'app_user'@'%';
FLUSH PRIVILEGES;

-- Show databases (for verification)
SHOW DATABASES;
