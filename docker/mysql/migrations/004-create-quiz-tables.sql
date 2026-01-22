-- Migration: Create quiz_questions and quiz_attempts tables
-- This migration adds quiz functionality to chapters, allowing each chapter to have multiple-choice questions
-- and track student quiz attempts with scores and detailed answers

USE titan_academy;

-- Create quiz_questions table
-- Stores quiz questions for each chapter with multiple choice options
-- Supports both single-choice (one correct answer) and multiple-choice (multiple correct answers) questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(36) PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    question_text TEXT NOT NULL,
    options JSON NOT NULL,
    question_type ENUM('single', 'multiple') DEFAULT 'single',
    correct_answer_index INT NULL,
    correct_answer_indices JSON NULL,
    explanation TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    INDEX idx_chapter_id (chapter_id),
    INDEX idx_order_index (order_index),
    INDEX idx_question_type (question_type),
    -- Ensure at least one correct answer field is set
    CHECK (
        (question_type = 'single' AND correct_answer_index IS NOT NULL) OR
        (question_type = 'multiple' AND correct_answer_indices IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create quiz_attempts table
-- Stores student quiz attempts with scores, answers, and completion timestamps
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    chapter_id VARCHAR(36) NOT NULL,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    answers JSON NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_chapter_id (chapter_id),
    INDEX idx_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
