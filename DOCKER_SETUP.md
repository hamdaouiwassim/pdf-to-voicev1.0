# Docker Setup Guide

This guide explains how to run the document-reader API and MySQL database using Docker Compose.

## Prerequisites

- Docker installed on your system ([Download Docker](https://www.docker.com/get-started))
- Docker Compose (usually included with Docker Desktop)

## Quick Start

1. **Navigate to the API directory:**
   ```bash
   cd document-reader/api
   ```

2. **Create a `.env` file** in the `api/` directory (if you don't have one):
   ```bash
   # Create .env file in the api directory
   cp .env.example .env
   # or copy from your existing root env if you have one
   ```

3. **Update the `.env` file** with your configuration:
   ```env
   # Required
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # MySQL Configuration (defaults shown)
   DB_ROOT_PASSWORD=rootpassword
   DB_NAME=titan_academy
   DB_USER=app_user
   DB_PASSWORD=app_password
   DB_PORT=3307
   
   # API Configuration
   PORT=3000
   ```

4. **Start the services (from the api directory):**
   ```bash
   docker-compose up -d
   ```

5. **Check the logs:**
   ```bash
   # View all logs
   docker-compose logs -f
   
   # View only API logs
   docker-compose logs -f api
   
   # View only MySQL logs
   docker-compose logs -f mysql
   ```

6. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

## Services

### MySQL Database

- **Container name:** `document-reader-mysql`
- **Port:** `3307` (configurable via `DB_PORT` in `.env`, default changed from 3306 to avoid conflicts)
- **Database:** `titan_academy` (configurable via `DB_NAME`)
- **Root password:** Set via `DB_ROOT_PASSWORD` in `.env`
- **Application user:** Set via `DB_USER` and `DB_PASSWORD` in `.env`

### API Server

- **Container name:** `document-reader-api`
- **Port:** `3000` (configurable via `PORT` in `.env`, mapped to internal port 3002)
- **Depends on:** MySQL service (waits for MySQL to be healthy)

## Connecting to MySQL

### From your host machine:

```bash
mysql -h 127.0.0.1 -P 3307 -u app_user -p titan_academy
# Password: app_password (or your DB_PASSWORD value)
# Note: Port is 3307 by default (changed from 3306 to avoid conflicts)
```

### From within the API container:

The API automatically connects to MySQL using the hostname `mysql` (the service name in docker-compose).

**Note:** The `docker-compose.yml` file is now located in the project root directory, not in the `api/` folder.

### Using a MySQL client:

- **Host:** `localhost` or `127.0.0.1`
- **Port:** `3307` (or your `DB_PORT` value, default changed from 3306)
- **Username:** `app_user` (or your `DB_USER` value)
- **Password:** `app_password` (or your `DB_PASSWORD` value)
- **Database:** `titan_academy` (or your `DB_NAME` value)

## Common Commands

### Start services:
```bash
docker-compose up -d
```

### Stop services:
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes database data):
```bash
docker-compose down -v
```

### Restart a specific service:
```bash
docker-compose restart mysql
docker-compose restart api
```

### View logs:
```bash
docker-compose logs -f [service_name]
```

### Execute commands in a container:
```bash
# Access MySQL container shell
docker-compose exec mysql bash

# Access API container shell
docker-compose exec api sh

# Run MySQL command line
docker-compose exec mysql mysql -u root -p titan_academy
```

### Rebuild containers (after code changes):
```bash
docker-compose up -d --build
```

## Database Initialization

The MySQL container automatically runs initialization scripts from `docker/mysql/init/` (in the project root) when first created. The `01-init.sql` script:

- Creates the database (if not already created)
- Sets up proper character encoding (utf8mb4)
- Grants privileges to the application user
- Includes example table schemas (commented out)

To customize the database schema, edit `docker/mysql/init/01-init.sql` (in the project root) and recreate the container:

```bash
docker-compose down -v
docker-compose up -d
```

## Data Persistence

Database data is stored in a Docker volume named `mysql_data`. This means:

- Data persists even when containers are stopped
- Data is removed only when you use `docker-compose down -v`
- To backup data, you can export the volume or use `mysqldump`

### Backup database:
```bash
# From project root directory
docker-compose exec mysql mysqldump -u root -p titan_academy > backup.sql
```

### Restore database:
```bash
# From project root directory
docker-compose exec -T mysql mysql -u root -p titan_academy < backup.sql
```

## Troubleshooting

### MySQL container won't start:

1. Check if port 3307 is already in use:
   ```bash
   # Windows
   netstat -ano | findstr :3307
   
   # Linux/Mac
   lsof -i :3307
   ```

2. Change the port in `.env` if needed:
   ```env
   DB_PORT=3308
   ```

3. Check MySQL logs:
   ```bash
   docker-compose logs mysql
   ```

### API can't connect to MySQL:

1. Verify MySQL is healthy:
   ```bash
   docker-compose ps
   ```

2. Check that the API container is using the correct hostname (`mysql`):
   ```bash
   docker-compose exec api env | grep DB_HOST
   # Should show: DB_HOST=mysql
   ```

3. Verify credentials in `.env` match MySQL configuration

### Permission errors:

If you encounter permission errors with volumes (uploads, audios), you may need to adjust file permissions:

```bash
# On Linux/Mac
sudo chown -R $USER:$USER api/uploads api/audios
```

## Development vs Production

### Development:
- Use `NODE_ENV=development` in `.env`
- Mount source code as volume for hot-reload (add to docker-compose.yml):
  ```yaml
  volumes:
    - .:/app
    - /app/node_modules
  ```

### Production:
- Use `NODE_ENV=production` in `.env`
- Use strong passwords for database
- Consider using Docker secrets for sensitive data
- Set up proper backup strategy

## Environment Variables

All environment variables are loaded from the `.env` file in the project root directory. See `api/ENV_VARIABLES.md` for a complete list of available variables.

Key variables for Docker:
- `DB_ROOT_PASSWORD`: MySQL root password
- `DB_NAME`: Database name
- `DB_USER`: Application database user
- `DB_PASSWORD`: Application database password
- `DB_PORT`: External MySQL port (default: 3307, changed from 3306 to avoid conflicts)
- `PORT`: External API port (default: 3000)
- `GEMINI_API_KEY`: Required for API functionality

## Network

Both services run on a custom bridge network (`document-reader-network`), allowing them to communicate using service names as hostnames:
- API connects to MySQL using hostname: `mysql`
- MySQL is accessible from host using: `localhost:3307` (default port changed from 3306)

## Stopping and Cleanup

### Stop services (keeps data):
```bash
docker-compose stop
```

### Stop and remove containers (keeps data):
```bash
docker-compose down
```

### Stop and remove everything including volumes (⚠️ deletes database):
```bash
docker-compose down -v
```

### Remove images:
```bash
docker-compose down --rmi all
```

## Next Steps

1. Verify the API is running: `http://localhost:3000/api/health`
2. Check database connection in API logs
3. Customize database schema in `docker/mysql/init/01-init.sql` (in project root)
4. Start building your application using the database connection module

For more information about using the database in your code, see `api/config/database.example.js`.

## Important Notes

- The `docker-compose.yml` file is located in the **project root directory**, not in the `api/` folder
- Run all `docker-compose` commands from the **project root directory**
- The MySQL initialization scripts are in `docker/mysql/init/` (project root)
- The API service builds from `./api` directory (relative to project root)

