# Database Migration Guide

This guide explains the migration from file-based storage to database storage for courses, chapters, and images.

## Overview

**Before:** Courses and chapters were stored as JSON files in the file system.
**After:** Courses, chapters, and images metadata are stored in MySQL database.

## Database Schema

### Tables Created

1. **courses** - Stores course metadata
2. **chapters** - Stores chapter metadata and content
3. **chapter_images** - Stores converted WebP image paths and metadata

## Setup Instructions

### Step 1: Create Database Tables

The tables are automatically created when MySQL container starts (via init script), but if you need to create them manually:

**Option A: Using Docker (Recommended)**
```bash
docker compose exec api node scripts/createDatabaseTables.js
```

**Option B: Using SQL directly**
```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy < api/docker/mysql/init/01-init.sql
```

### Step 2: Verify Tables

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW TABLES;"
```

You should see:
- `users`
- `courses`
- `chapters`
- `chapter_images`

## What Changed

### File Storage (Still Used)
- **PDF files** - Still stored in `api/uploads/courses/{courseId}/{chapterId}/`
- **WebP images** - Still stored in `api/uploads/courses/{courseId}/{chapterId}/webp/`
- **Audio files** - Still stored in `api/audios/`

### Database Storage (New)
- **Course metadata** - Name, description, timestamps
- **Chapter metadata** - Name, description, video link, text content, filenames
- **Chapter images** - Paths to WebP images, page numbers, metadata
- **Statements** - Stored as JSON in chapters table

## API Changes

All API endpoints work the same way, but now they:
- Read from database instead of JSON files
- Write to database instead of JSON files
- Still serve PDFs and images from file system

## Migration from Existing Data

If you have existing courses/chapters in JSON files, you'll need to migrate them:

### Option 1: Re-upload (Recommended for small datasets)
- Delete old courses
- Re-upload courses and chapters through the API
- Data will be stored in database automatically

### Option 2: Manual Migration Script (For large datasets)
Create a migration script to:
1. Read JSON files from `api/uploads/courses/`
2. Insert data into database tables
3. Copy image paths to `chapter_images` table

## Benefits

✅ **Better Performance** - Database queries are faster than file I/O
✅ **Data Integrity** - Foreign keys ensure referential integrity
✅ **Easier Queries** - SQL queries for filtering, searching, sorting
✅ **Scalability** - Database can handle more data efficiently
✅ **Backup** - Single database backup instead of many files

## Troubleshooting

### Tables not created?

Run the creation script:
```bash
docker compose exec api node scripts/createDatabaseTables.js
```

### Can't find courses/chapters?

1. Check database connection:
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT COUNT(*) FROM courses;"
   ```

2. Verify API is using database:
   - Check API logs for database connection errors
   - Ensure `.env` has correct database credentials

### Data not showing?

1. Verify data exists in database:
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT * FROM courses LIMIT 5;"
   ```

2. Check API logs for errors:
   ```bash
   docker compose logs api | grep -i error
   ```

## Rollback

If you need to rollback to file-based storage:
1. Restore from backup
2. Revert code changes
3. Restart containers

**Note:** Database and file storage can coexist - old JSON files won't interfere, but new data will only be in the database.

## Next Steps

1. ✅ Tables created
2. ✅ Controllers updated
3. ✅ API endpoints working
4. ⏳ Migrate existing data (if needed)
5. ⏳ Add database indexes for performance (if needed)
6. ⏳ Set up database backups

