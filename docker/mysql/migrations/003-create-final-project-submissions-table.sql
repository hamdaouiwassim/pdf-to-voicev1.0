-- Migration: Create final_project_submissions table
-- This table stores student submissions for final projects

USE titan_academy;

-- Create final_project_submissions table
CREATE TABLE IF NOT EXISTS final_project_submissions (
    id VARCHAR(36) PRIMARY KEY,
    final_project_id VARCHAR(36) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    file_resource VARCHAR(500),
    comment TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (final_project_id) REFERENCES final_projects(id) ON DELETE CASCADE,
    INDEX idx_final_project_id (final_project_id),
    INDEX idx_user_email (user_email),
    INDEX idx_submitted_at (submitted_at),
    UNIQUE KEY unique_user_final_project (final_project_id, user_email) -- One submission per user per project
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
