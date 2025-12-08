# Debug: Why Courses Aren't in Database

## Quick Diagnosis

Run these commands to diagnose the issue:

### 1. Check API Logs for Errors

```bash
docker compose logs api --tail 100 | grep -i "error\|course\|database"
```

Look for:
- `[DB] Course created successfully` - Good sign
- `[DB] Error creating course` - Database error
- `[Course Create Error]` - API error

### 2. Verify API Container Has Updated Code

```bash
# Check if dbUtils exists and has createCourse function
docker compose exec api grep -A 5 "createCourse" utils/dbUtils.js
```

If you see "No such file" or old code, rebuild:

```bash
docker compose build api
docker compose restart api
```

### 3. Test Database Connection from API

```bash
docker compose exec api node -e "
const db = require('./config/database');
db.testConnection().then(() => {
  console.log('✓ Database connection OK');
  process.exit(0);
}).catch(err => {
  console.error('✗ Connection failed:', err.message);
  process.exit(1);
});
"
```

### 4. Test Manual Insert

Test if database accepts inserts:

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "
INSERT INTO courses (id, course_name, course_description) 
VALUES ('manual-test-123', 'Manual Test', 'Testing');
SELECT * FROM courses WHERE id = 'manual-test-123';
DELETE FROM courses WHERE id = 'manual-test-123';
"
```

If this works, database is fine. Issue is in API.

### 5. Check What Database API is Using

```bash
docker compose exec api printenv | grep DB_
```

Should match your `.env` file.

### 6. Watch Real-Time Logs While Creating Course

```bash
# Terminal 1: Watch logs
docker compose logs -f api

# Terminal 2: Create a course via API
# (Use your frontend or curl)
```

Look for:
- `[DB] Course created successfully: <id> - <name>` ✅
- `[DB] Error creating course:` ❌
- `[Course Create Error]` ❌

## Most Common Fix

**Rebuild the API container** - This is usually the issue:

```bash
docker compose build api
docker compose restart api
```

Then try creating a course again and check logs.

## If Still Not Working

1. **Check if courses are in files instead:**
   ```bash
   ls -la api/uploads/courses/*.json
   ```
   If JSON files exist, API is using old file-based code.

2. **Verify database credentials:**
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT DATABASE();"
   ```

3. **Check for transaction issues:**
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW VARIABLES LIKE 'autocommit';"
   ```

4. **Test with a simple Node.js script:**
   ```bash
   docker compose exec api node -e "
   const db = require('./config/database');
   const dbUtils = require('./utils/dbUtils');
   dbUtils.createCourse({
     id: 'test-' + Date.now(),
     courseName: 'Test Course',
     courseDescription: 'Test'
   }).then(course => {
     console.log('✓ Course created:', course);
     process.exit(0);
   }).catch(err => {
     console.error('✗ Error:', err.message);
     process.exit(1);
   });
   "
   ```

## Expected Behavior

When you create a course:
1. API receives request
2. Logs: `[DB] Course created successfully: <id> - <name>`
3. Database has the record
4. API returns success response

If step 2 or 3 fails, check the logs for the error message.

