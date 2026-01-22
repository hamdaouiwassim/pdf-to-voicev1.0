-- Migration: Add question_type and support for multiple correct answers
-- This migration adds support for both single-choice and multiple-choice questions

USE titan_academy;

-- Modify correct_answer_index to allow NULL (for multiple-choice questions)
ALTER TABLE quiz_questions 
MODIFY COLUMN correct_answer_index INT NULL;

-- Add new columns for question type support
ALTER TABLE quiz_questions 
ADD COLUMN IF NOT EXISTS question_type ENUM('single', 'multiple') DEFAULT 'single' AFTER options,
ADD COLUMN IF NOT EXISTS correct_answer_indices JSON NULL AFTER correct_answer_index;

-- Update existing questions to ensure they have question_type set
UPDATE quiz_questions 
SET question_type = 'single' 
WHERE question_type IS NULL;

-- Add index for question_type
CREATE INDEX IF NOT EXISTS idx_question_type ON quiz_questions(question_type);
