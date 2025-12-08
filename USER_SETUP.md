# User Setup Guide

This guide explains how to set up user authentication with the database.

## Database Users Table

The `users` table is automatically created when the MySQL container starts. It includes:

- `id` - Primary key
- `email` - Unique email address (used for login)
- `password` - Hashed password (using bcrypt)
- `name` - User's full name (optional)
- `role` - User role: 'admin' or 'user' (default: 'user')
- `is_active` - Whether the user account is active (default: TRUE)
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp
- `last_login` - Last login timestamp

## Creating the First Admin User

### Method 1: Using the Script (Recommended)

1. **Make sure MySQL is running:**
   ```bash
   docker compose ps
   # or
   docker-compose ps
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   npm install
   ```

3. **Create admin user:**
   ```bash
   npm run create-admin
   ```

   This will create an admin user with:
   - Email: `admin@titanacademy.com` (or from `ADMIN_EMAIL` env var)
   - Password: `admin123` (or from `ADMIN_PASSWORD` env var)
   - Name: `Administrator` (or from `ADMIN_NAME` env var)
   - Role: `admin`

### Method 2: Using Environment Variables

Set these in your `.env` file before running the script:

```env
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Your Name
```

Then run:
```bash
npm run create-admin
```

### Method 3: Manual SQL Insert

Connect to MySQL and insert manually:

```sql
USE titan_academy;

-- Note: You'll need to hash the password first using bcrypt
-- For now, use the createAdminUser.js script which handles hashing
```

## Creating Additional Users

You can create additional users by:

1. **Using the script multiple times** (it will update existing users)
2. **Creating an API endpoint** for user registration (future enhancement)
3. **Directly inserting into the database** (remember to hash passwords with bcrypt)

## Password Security

- Passwords are hashed using bcrypt (10 rounds)
- Never store plain text passwords
- Use the `createAdminUser.js` script to ensure proper password hashing

## User Roles

- **admin**: Full access to course and chapter management
- **user**: Limited access (can be extended in the future)

## Troubleshooting

### "User already exists" message

The script will update the password if the user already exists. This is safe to run multiple times.

### Database connection error

Make sure:
1. MySQL container is running: `docker compose ps`
2. Database credentials in `.env` are correct
3. Database is accessible: `docker compose exec mysql mysql -u app_user -p titan_academy`

### Password not working

1. Make sure you're using the correct email (case-insensitive)
2. Verify the user exists: `SELECT email, role FROM users WHERE email = 'your@email.com';`
3. Recreate the user: `npm run create-admin`

## Example: Creating Multiple Users

To create multiple admin users, you can modify the script or run it with different environment variables:

```bash
ADMIN_EMAIL=admin1@example.com ADMIN_PASSWORD=pass1 npm run create-admin
ADMIN_EMAIL=admin2@example.com ADMIN_PASSWORD=pass2 npm run create-admin
```

