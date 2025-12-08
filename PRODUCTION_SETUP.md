# Production Setup Guide

Complete step-by-step guide to set up the API with MySQL on production.

## Prerequisites

- Docker and Docker Compose installed on your production server
- Node.js and npm installed (for running scripts)
- Access to your production server via SSH

## Step 1: Prepare Your Environment

### 1.1 Navigate to the API directory

```bash
cd /path/to/your/project/api
```

### 1.2 Create or Update `.env` file

Create a `.env` file in the `api/` directory with your production configuration:

```env
# AI Configuration
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
FREE_AI_PROVIDER=groq
USE_FREE_AI=true

# Server Configuration
PORT=3002
NODE_ENV=production

# MySQL Database Configuration
DB_ROOT_PASSWORD=titan@147852aS
DB_NAME=titan_academy
DB_USER=app_user
DB_PASSWORD=app_password
DB_PORT=3307
DB_CONNECTION_LIMIT=10

# Authentication Configuration
ADMIN_EMAIL=admin@titanacademy.com
ADMIN_PASSWORD=titan@12345&a
ADMIN_NAME=Administrator
SESSION_SECRET=titan@12345&a

# Optional
RHUBARB_PATH=
```

**⚠️ Important:** 
- Change all default passwords in production!
- Keep your `.env` file secure and never commit it to git
- Use strong, unique passwords

## Step 2: Build Docker Image (Optional - if not already built)

The API container will automatically build when you start it, but you can build it manually:

```bash
docker compose build api
```

**Note:** Dependencies are installed inside the Docker container during build. You don't need to run `npm install` on the host machine.

## Step 3: Start MySQL Container

### 3.1 Start MySQL only (to create database first)

```bash
docker compose up -d mysql
```

Or if using older Docker Compose:
```bash
docker-compose up -d mysql
```

### 3.2 Wait for MySQL to be ready

Check the logs to ensure MySQL started successfully:

```bash
docker compose logs mysql
```

Wait until you see: `[Server] /usr/sbin/mysqld: ready for connections`

This usually takes 10-30 seconds.

### 3.3 Verify MySQL is running

```bash
docker compose ps
```

You should see `document-reader-mysql` with status "Up".

## Step 4: Create the Users Table

### 4.1 Check if table exists (optional)

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW TABLES;"
```

If you see `users` in the output, skip to Step 5. If not, continue.

### 4.2 Create the users table

**Option A: Using Node.js script inside Docker container (Recommended)**

First, make sure the API container is built (it will be built when you start it):
```bash
docker compose up -d api
```

Then run the script:
```bash
docker compose exec api node scripts/createUsersTable.js
```

This will:
- Check if the table exists
- Create it if it doesn't exist
- Show the table structure
- Display any existing users

**Note:** The script runs inside the API container where all dependencies are already installed. The `.env` file is automatically mounted into the container.

**Option B: Using SQL directly**

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy
```

Then run:

```sql
USE titan_academy;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role ENUM('admin', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify
SHOW TABLES;
DESCRIBE users;
exit;
```

### 4.3 Verify table was created

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "DESCRIBE users;"
```

You should see the table structure with columns: id, email, password, name, role, is_active, etc.

## Step 5: Create Admin User

### 5.1 Create the admin user

**Option A: Using Node.js script inside Docker container (Recommended)**

```bash
docker compose exec api node scripts/createAdminUser.js
```

This will:
- Read credentials from your `.env` file (mounted in container)
- Hash the password securely
- Create or update the admin user
- Display the credentials

**Note:** The script runs inside the API container where all dependencies (bcrypt, mysql2) are already installed.

**Expected output:**
```
Creating admin user...
Email: admin@titanacademy.com
✓ Admin user created successfully!

Admin credentials:
  Email: admin@titanacademy.com
  Password: titan@12345&a

⚠️  IMPORTANT: Change the default password after first login!
```

### 5.2 Verify user was created

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT id, email, name, role, is_active FROM users;"
```

You should see your admin user listed.

## Step 6: Start the API Container

### 6.1 Build and start all services

```bash
docker compose up -d
```

This will:
- Build the API container (if needed)
- Start MySQL (if not already running)
- Start the API
- Wait for MySQL to be healthy before starting API

### 6.2 Check all containers are running

```bash
docker compose ps
```

You should see both:
- `document-reader-mysql` - Status: Up
- `document-reader-api` - Status: Up

### 6.3 Check API logs

```bash
docker compose logs api
```

Or follow logs in real-time:

```bash
docker compose logs -f api
```

Look for:
- `Server is running on port 3002`
- `Database connection successful`
- No error messages

## Step 7: Verify Everything Works

### 7.1 Test database connection

```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT COUNT(*) as user_count FROM users;"
```

### 7.2 Test API health (if you have a health endpoint)

```bash
curl http://localhost:3000/api/health
```

Or visit in browser: `http://your-server-ip:3000`

### 7.3 Test login

Visit: `http://your-server-ip:3000/login.html`

Login with:
- Email: `admin@titanacademy.com` (from your .env)
- Password: `titan@12345&a` (from your .env)

## Step 8: Production Best Practices

### 8.1 Set up firewall rules

Only expose necessary ports:
- Port 3000 (or your configured PORT) - API
- Port 3307 - MySQL (only if you need external access, otherwise keep it internal)

### 8.2 Set up SSL/TLS

For production, use a reverse proxy (nginx, Apache) with SSL certificates.

### 8.3 Regular backups

Backup your MySQL data:

```bash
docker compose exec mysql mysqldump -u app_user -papp_password titan_academy > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 8.4 Monitor logs

```bash
# View all logs
docker compose logs -f

# View only API logs
docker compose logs -f api

# View only MySQL logs
docker compose logs -f mysql
```

### 8.5 Update containers

```bash
# Pull latest images
docker compose pull

# Rebuild and restart
docker compose up -d --build
```

## Troubleshooting

### MySQL container won't start

```bash
# Check logs
docker compose logs mysql

# Check if port is in use
netstat -tuln | grep 3307

# Remove and recreate (WARNING: This deletes data)
docker compose down -v
docker compose up -d mysql
```

### API can't connect to MySQL

1. Check MySQL is running: `docker compose ps`
2. Check MySQL logs: `docker compose logs mysql`
3. Verify credentials in `.env` match docker-compose.yml
4. Test connection: `docker compose exec mysql mysql -u app_user -papp_password titan_academy`

### Users table not found

Run: `docker compose exec api node scripts/createUsersTable.js`

**Note:** If the API container isn't running yet, you can use SQL directly:
```bash
docker compose exec mysql mysql -u app_user -papp_password titan_academy < docker/mysql/migrations/001-create-users-table.sql
```

### Can't login

1. Verify user exists: 
   ```bash
   docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT email, role FROM users;"
   ```

2. Recreate admin user:
   ```bash
   docker compose exec api node scripts/createAdminUser.js
   ```
   
   **Note:** If the API container isn't running, you'll need to start it first or use SQL with a pre-hashed password.

3. Check password in `.env` matches what you're using

### Port already in use

Change the port in `.env`:
```env
DB_PORT=3308  # Use a different port
PORT=3001     # Use a different API port
```

Then restart: `docker compose down && docker compose up -d`

## Quick Reference Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f api

# Access MySQL
docker compose exec mysql mysql -u app_user -papp_password titan_academy

# Create users table (inside Docker)
docker compose exec api node scripts/createUsersTable.js

# Create admin user (inside Docker)
docker compose exec api node scripts/createAdminUser.js

# Restart services
docker compose restart

# View running containers
docker compose ps

# Check database
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SHOW TABLES;"
```

## Summary Checklist

- [ ] Created `.env` file with production values
- [ ] Started MySQL container (`docker compose up -d mysql`)
- [ ] Created users table (`docker compose exec api node scripts/createUsersTable.js`)
- [ ] Created admin user (`docker compose exec api node scripts/createAdminUser.js`)
- [ ] Started all containers (`docker compose up -d`)
- [ ] Verified containers are running (`docker compose ps`)
- [ ] Tested login at `/login.html`
- [ ] Set up firewall rules
- [ ] Configured backups

## Support

If you encounter issues:
1. Check the logs: `docker compose logs`
2. Verify your `.env` configuration
3. Ensure all containers are running: `docker compose ps`
4. Test database connection manually

