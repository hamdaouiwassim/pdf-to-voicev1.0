-- Migration script to create qa_history table
-- Usage: docker compose exec mysql mysql -u app_user -papp_password titan_academy < docker/mysql/migrations/007-create-qa-history-table.sql

USE titan_academy;

CREATE TABLE IF NOT EXISTS qa_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    chapter_id VARCHAR(36) NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    audio_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_qa_history_user_id (user_id),
    INDEX idx_qa_history_course_id (course_id),
    INDEX idx_qa_history_chapter_id (chapter_id),
    INDEX idx_qa_history_created_at (created_at),
    CONSTRAINT fk_qa_history_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW TABLES LIKE 'qa_history';
DESCRIBE qa_history;
