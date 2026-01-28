-- Migration script to create password_resets table
-- Usage: docker compose exec mysql mysql -u app_user -papp_password titan_academy < docker/mysql/migrations/006-create-password-resets-table.sql

USE titan_academy;

CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at TIMESTAMP NULL,
    request_ip VARCHAR(64),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_resets_user_id (user_id),
    UNIQUE KEY uniq_password_resets_token_hash (token_hash),
    CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW TABLES LIKE 'password_resets';
DESCRIBE password_resets;
