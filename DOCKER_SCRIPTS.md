# Running Scripts in Docker Containers

Since the API runs inside a Docker container, all Node.js scripts should be executed inside the container where dependencies are already installed.

## Prerequisites

The `.env` file is automatically mounted into the API container, so scripts can read environment variables.

## Available Scripts

### 1. Create Users Table

```bash
# Make sure API container is running
docker compose up -d api

# Run the script inside the container
docker compose exec api node scripts/createUsersTable.js
```

### 2. Create Admin User

```bash
# Make sure API container is running
docker compose up -d api

# Run the script inside the container
docker compose exec api node scripts/createAdminUser.js
```

## Alternative: If API Container Isn't Running

If you need to create the table before starting the API container, use SQL directly:

### Create Users Table via SQL

```bash
# Connect to MySQL
docker compose exec mysql mysql -u app_user -papp_password titan_academy

# Then run:
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

exit;
```

### Create Admin User via SQL (Advanced)

**Note:** This requires manually hashing the password with bcrypt, which is complex. It's easier to start the API container and use the Node.js script.

If you must use SQL, you'll need to:
1. Generate a bcrypt hash of your password (use an online tool or Node.js)
2. Insert the user with the hashed password

```sql
-- Example (password: "admin123" hashed with bcrypt, rounds=10)
-- You need to generate this hash yourself
INSERT INTO users (email, password, name, role, is_active) 
VALUES ('admin@titanacademy.com', '$2b$10$...hashed_password...', 'Administrator', 'admin', TRUE);
```

**Recommended:** Just start the API container and use the Node.js script instead.

## Why Run Scripts in Docker?

1. **No local dependencies needed** - All npm packages are installed in the container
2. **Consistent environment** - Same Node.js version and dependencies as production
3. **No npm install required** - Everything is already set up in the container
4. **Environment variables** - `.env` file is automatically mounted

## Troubleshooting

### "Container not running" error

Start the container first:
```bash
docker compose up -d api
```

### "Cannot find module" error

Make sure the container is built with all dependencies:
```bash
docker compose build api
docker compose up -d api
```

### ".env file not found" error

Make sure `.env` file exists in the `api/` directory. It's automatically mounted into the container.

### Script runs but can't connect to database

Check that:
1. MySQL container is running: `docker compose ps`
2. Database credentials in `.env` match docker-compose.yml
3. Both containers are on the same network (they should be automatically)

