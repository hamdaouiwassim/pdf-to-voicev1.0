# Troubleshooting: Courses Not Saving to Database

If you see "courses and chapters added successfully" but the database is empty, follow these steps:

## Step 1: Check API Logs

Check if there are any database errors:

```bash
docker compose logs api | grep -i error
```

Or view recent logs:
```bash
docker compose logs api --tail 50
```

Look for:
- Database connection errors
- SQL syntax errors
- "Course Create Error" messages

## Step 2: Verify API Container Has Updated Code

The API container might be running old code. Rebuild it:

```bash
docker compose build api
docker compose restart api
```

## Step 3: Test Database Connection

Test if the API can connect to the database:

```bash
docker compose exec api node -e "
const db = require('./config/database');
db.testConnection().then(() => {
  console.log('✓ Database connection successful');
  process.exit(0);
}).catch(err => {
  console.error('✗ Database connection failed:', err.message);
  process.exit(1);
});
"
```

## Step 4: Test Course Creation Directly

Test if database insert works:

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "
INSERT INTO courses (id, course_name, course_description) 
VALUES ('test-123', 'Test Course', 'Test Description');
SELECT * FROM courses WHERE id = 'test-123';
"
```

If this works, the database is fine. The issue is in the API code.

## Step 5: Check Database Credentials

Verify the API is using correct database credentials:

```bash
docker compose exec api printenv | grep DB_
```

Should show:
- `DB_HOST=mysql`
- `DB_PORT=3306`
- `DB_USER=app_user`
- `DB_PASSWORD=app_password`
- `DB_NAME=titan_academy`

## Step 6: Manual Test via API

Test creating a course via API and watch logs:

```bash
# In one terminal, watch logs
docker compose logs -f api

# In another terminal, create a course
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Cookie: $(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@titanacademy.com\",\"password\":\"titan@12345&a\"}' -c - | grep titan | awk '{print $7}')" \
  -d '{"courseName":"Test Course","courseDescription":"Test"}'
```

Watch the logs for any errors.

## Step 7: Check if Data is Being Written Elsewhere

Check if courses are still being saved to files:

```bash
ls -la api/uploads/courses/*.json
```

If JSON files exist, the API might still be using the old file-based system.

## Step 8: Verify Code is Updated

Check if the API container has the updated dbUtils:

```bash
docker compose exec api cat utils/dbUtils.js | head -30
```

Should show the `createCourse` function.

## Common Issues

### Issue 1: Container Not Rebuilt
**Solution:** Rebuild and restart:
```bash
docker compose build api
docker compose restart api
```

### Issue 2: Database Connection Failing
**Solution:** Check credentials and connection:
```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT 1;"
```

### Issue 3: Silent Errors
**Solution:** Check error handling in dbUtils.js - errors might be caught but not logged.

### Issue 4: Transaction Rollback
**Solution:** Check if there are any foreign key constraint violations or other database errors.

## Quick Fix: Rebuild Everything

If nothing else works:

```bash
# Stop containers
docker compose down

# Rebuild API
docker compose build api

# Start everything
docker compose up -d

# Check logs
docker compose logs -f api
```

Then try creating a course again and watch the logs.

