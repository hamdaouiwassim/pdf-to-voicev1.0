# Database Tables Setup

There are multiple ways to create the database tables. Choose the method that works best for your situation.

## Method 1: Automatic (Recommended)

The tables are **automatically created** when the MySQL container starts for the first time via the init script at `api/docker/mysql/init/01-init.sql`.

**If you just created a new MySQL container, the tables should already exist!**

To verify:
```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW TABLES;"
```

You should see:
- `users`
- `courses`
- `chapters`
- `chapter_images`

## Method 2: Run SQL Directly (If tables don't exist)

If the tables weren't created automatically, you can run the SQL directly:

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy
```

Then paste this SQL:

```sql
USE titan_academy;

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(36) PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    course_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_course_name (course_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    chapter_name VARCHAR(255) NOT NULL,
    chapter_description TEXT,
    video_link VARCHAR(500),
    text_content LONGTEXT,
    text_filename VARCHAR(255),
    visual_filename VARCHAR(255),
    statements_filename VARCHAR(255),
    text_length INT DEFAULT 0,
    num_pages_text INT DEFAULT 0,
    num_pages_visual INT DEFAULT 0,
    num_pages_statements INT DEFAULT 0,
    statements_count INT DEFAULT 0,
    statements JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    INDEX idx_course_id (course_id),
    INDEX idx_chapter_name (chapter_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create chapter_images table
CREATE TABLE IF NOT EXISTS chapter_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapter_id VARCHAR(36) NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    page_number INT,
    image_type ENUM('webp', 'jpg', 'png') DEFAULT 'webp',
    file_size BIGINT,
    width INT,
    height INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    INDEX idx_chapter_id (chapter_id),
    INDEX idx_page_number (page_number),
    INDEX idx_image_type (image_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify
SHOW TABLES;
exit;
```

## Method 3: Using Node.js Script (After rebuilding container)

If you want to use the Node.js script:

1. **Rebuild the container** to include the new script:
   ```bash
   docker compose build api
   docker compose up -d api
   ```

2. **Then run the script:**
   ```bash
   docker compose exec api node scripts/createDatabaseTables.js
   ```

## Method 4: Copy SQL file into container

```bash
# Copy the init SQL file
docker compose cp api/docker/mysql/init/01-init.sql mysql:/tmp/init.sql

# Run it
docker compose exec mysql mysql -u app_user -papp_password titan_academy < /tmp/init.sql
```

Or run it directly:
```bash
docker compose exec -T mysql mysql -u app_user -papp_password titan_academy < api/docker/mysql/init/01-init.sql
```

## Troubleshooting

### "Table already exists" error

This is fine! The `CREATE TABLE IF NOT EXISTS` statements won't fail if tables already exist.

### "Cannot find module" error

The script isn't in the container. Use **Method 2** (SQL directly) instead.

### "Access denied" error

Check your database credentials in `.env`:
- `DB_USER`
- `DB_PASSWORD`

### Tables not showing up

1. Make sure you're using the correct database:
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW TABLES;"
   ```

2. Check if database exists:
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password -e "SHOW DATABASES;"
   ```

## Quick Verification

After creating tables, verify they exist:

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW TABLES;"
```

Expected output:
```
+---------------------------+
| Tables_in_titan_academy   |
+---------------------------+
| chapter_images            |
| chapters                  |
| courses                   |
| users                     |
+---------------------------+
```

## Next Steps

Once tables are created:
1. ✅ Tables exist
2. ✅ API can now store courses/chapters in database
3. ✅ Create your first course via API
4. ✅ Verify data in database: `SELECT * FROM courses;`

