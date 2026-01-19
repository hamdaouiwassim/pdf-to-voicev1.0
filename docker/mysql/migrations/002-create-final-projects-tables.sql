-- Migration: Create final_projects and final_project_documents tables
-- This separates final projects from labs as a distinct feature

USE titan_academy;

-- Create final_projects table
CREATE TABLE IF NOT EXISTS final_projects (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    project_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_course_final_project (course_id), -- Only one final project per course
    INDEX idx_course_id (course_id),
    INDEX idx_project_name (project_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create final_project_documents table
CREATE TABLE IF NOT EXISTS final_project_documents (
    id VARCHAR(36) PRIMARY KEY,
    final_project_id VARCHAR(36) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_description TEXT,
    pdf_resource VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (final_project_id) REFERENCES final_projects(id) ON DELETE CASCADE,
    INDEX idx_final_project_id (final_project_id),
    INDEX idx_document_name (document_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
