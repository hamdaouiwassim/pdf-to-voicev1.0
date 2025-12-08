# Data Storage Guide

This document explains where and how courses and chapters data are stored in the system.

## Overview

**Courses and chapters are stored in the file system**, not in the MySQL database. The MySQL database is only used for:
- User authentication (users table)
- Future database-backed features

## Storage Location

### Base Directory
All data is stored in: `api/uploads/`

This directory is mounted as a Docker volume, so data persists even when containers are restarted.

### Directory Structure

```
api/uploads/
├── courses/                          # All courses are stored here
│   ├── {courseId}.json              # Course metadata file
│   └── {courseId}/                   # Course directory
│       └── {chapterId}/              # Chapter directory
│           ├── {chapterId}.json      # Chapter metadata file
│           ├── {chapterId}_text.pdf # Text PDF (for TTS)
│           ├── {chapterId}_visual.pdf # Visual PDF (for display)
│           ├── {chapterId}_statements.pdf # Statements PDF (optional)
│           └── webp/                 # Converted WebP images
│               ├── {chapterId}_visual_page-01.webp
│               ├── {chapterId}_visual_page-02.webp
│               └── ...
└── [other files...]
```

## Course Storage

### Course Metadata File
**Location:** `api/uploads/courses/{courseId}.json`

**Example:**
```json
{
  "id": "57f81a97-af9b-427c-b236-c46ee861b66e",
  "courseName": "Introduction to Programming",
  "courseDescription": "Learn the basics of programming",
  "chapters": [
    {
      "id": "8cc0dbb9-5eff-495b-803e-505d7bafcab4",
      "chapterName": "Chapter 1: Getting Started",
      "chapterDescription": "Introduction to the course",
      "videoLink": null,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Course Directory
**Location:** `api/uploads/courses/{courseId}/`

Contains all chapters for that course.

## Chapter Storage

### Chapter Metadata File
**Location:** `api/uploads/courses/{courseId}/{chapterId}/{chapterId}.json`

**Example:**
```json
{
  "id": "8cc0dbb9-5eff-495b-803e-505d7bafcab4",
  "courseId": "57f81a97-af9b-427c-b236-c46ee861b66e",
  "chapterName": "Chapter 1: Getting Started",
  "chapterDescription": "Introduction to the course",
  "videoLink": "https://example.com/video.mp4",
  "text": "Full extracted text from PDF...",
  "textFilename": "8cc0dbb9-5eff-495b-803e-505d7bafcab4_text.pdf",
  "visualFilename": "8cc0dbb9-5eff-495b-803e-505d7bafcab4_visual.pdf",
  "statementsFilename": null,
  "length": 5000,
  "numPagesText": 10,
  "numPagesVisual": 10,
  "numPagesStatements": 0,
  "statementsCount": 5,
  "statements": [
    {
      "id": "stmt-1",
      "chapterId": "8cc0dbb9-5eff-495b-803e-505d7bafcab4",
      "page": 1,
      "statement": "What is programming?",
      "type": "question"
    }
  ],
  "webpImages": [
    "courses/57f81a97-af9b-427c-b236-c46ee861b66e/8cc0dbb9-5eff-495b-803e-505d7bafcab4/webp/8cc0dbb9-5eff-495b-803e-505d7bafcab4_visual_page-01.webp"
  ],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Chapter Files
**Location:** `api/uploads/courses/{courseId}/{chapterId}/`

- **Text PDF:** `{chapterId}_text.pdf` - Full text content for TTS
- **Visual PDF:** `{chapterId}_visual.pdf` - PDF for display (optional if video link exists)
- **Statements PDF:** `{chapterId}_statements.pdf` - Exercise statements (optional)
- **WebP Images:** `webp/` directory - Converted images from visual PDF

## Data Persistence

### Docker Volume Mount

The `uploads` directory is mounted as a volume in `docker-compose.yml`:

```yaml
volumes:
  - ./uploads:/app/uploads
```

This means:
- ✅ Data persists when containers restart
- ✅ Data is stored on the host filesystem
- ✅ You can backup by copying the `api/uploads/` directory
- ✅ Data survives container removal (unless you use `docker compose down -v`)

### Backup Recommendations

1. **Regular Backups:**
   ```bash
   # Backup entire uploads directory
   tar -czf backup-$(date +%Y%m%d).tar.gz api/uploads/
   ```

2. **Backup to Remote Storage:**
   - Use rsync, S3, or cloud storage
   - Automate with cron jobs

3. **Database Backup (for users):**
   ```bash
   docker compose exec mysql mysqldump -u app_user -papp_password titan_academy > users_backup.sql
   ```

## Accessing Data

### From Host Machine

```bash
# View courses
ls -la api/uploads/courses/

# View a specific course
cat api/uploads/courses/{courseId}.json

# View a chapter
cat api/uploads/courses/{courseId}/{chapterId}/{chapterId}.json
```

### From Docker Container

```bash
# Access API container
docker compose exec api bash

# Navigate to uploads
cd /app/uploads

# List courses
ls -la courses/

# View course metadata
cat courses/{courseId}.json
```

### Via API Endpoints

- `GET /api/courses` - List all courses
- `GET /api/courses/:courseId` - Get course details
- `GET /api/courses/:courseId/chapters` - List chapters
- `GET /api/courses/:courseId/chapters/:chapterId` - Get chapter details

## Data Migration

If you need to move data to a new server:

1. **Copy uploads directory:**
   ```bash
   scp -r api/uploads/ user@new-server:/path/to/api/
   ```

2. **Ensure permissions:**
   ```bash
   chmod -R 755 api/uploads/
   ```

3. **Restart containers:**
   ```bash
   docker compose restart
   ```

## Current Limitations

- ❌ No database storage for courses/chapters (file-based only)
- ❌ No built-in search/indexing
- ❌ No versioning or history
- ❌ No concurrent editing protection

## Future Considerations

If you want to migrate to database storage:

1. Create `courses` and `chapters` tables in MySQL
2. Migrate existing JSON files to database
3. Update controllers to use database instead of file system
4. Keep file storage for PDFs and images

## Summary

| Data Type | Storage Location | Format |
|-----------|-----------------|--------|
| **Users** | MySQL Database (`users` table) | Database |
| **Courses** | File System (`api/uploads/courses/{courseId}.json`) | JSON |
| **Chapters** | File System (`api/uploads/courses/{courseId}/{chapterId}/`) | JSON + PDFs |
| **PDFs** | File System (inside chapter directories) | Binary |
| **WebP Images** | File System (`webp/` subdirectories) | Binary |
| **Audio Files** | File System (`api/audios/`) | Binary |

## Quick Reference

```bash
# View all courses
ls api/uploads/courses/*.json

# Count courses
ls api/uploads/courses/*.json | wc -l

# View course structure
cat api/uploads/courses/{courseId}.json | jq .

# Find large chapters
du -sh api/uploads/courses/*/

# Backup everything
tar -czf backup.tar.gz api/uploads/
```

