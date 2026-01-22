# Building API Backend Without MySQL

This guide explains how to build and run the Titan Academy API backend without MySQL. The API can function without a database for basic operations like document processing, TTS, and QA, though features requiring data persistence (courses, chapters, users) will be limited.

## Quick Start

**For Docker (Recommended):**
```bash
cd api
docker-compose -f docker-compose.api-only.yml up -d
```

**For Local Development:**
```bash
cd api
npm install
# Create .env file with GEMINI_API_KEY (no DB config needed)
npm start
```

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Docker (optional, for containerized deployment)

## Option 1: Local Development (No Docker)

### Step 1: Install Dependencies

```bash
cd api
npm install
```

### Step 2: Configure Environment

Create a `.env` file in the `api/` directory:

```env
# Required: Gemini API Key for TTS and QA
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (Leave empty or unset to run without MySQL)
# DB_HOST=
# DB_PORT=
# DB_USER=
# DB_NAME=
# DB_PASSWORD=
```

**Important:** If you don't set `DB_HOST` and `DB_NAME`, the API will start without MySQL. The server will log a warning but continue running.

### Step 3: Create Required Directories

```bash
mkdir -p media temp
```

The API uses a `media/` folder layout: `media/_global/uploads`, `media/_global/audios`, and `media/{courseId}/...` for course assets.

### Step 4: Start the Server

```bash
npm start
```

Or directly:

```bash
node server.js
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Expected Output

When running without MySQL, you'll see:

```
⚠ MySQL database not configured (DB_HOST/DB_NAME not set)
✓ Server is running at http://0.0.0.0:3000
```

The API will still function for:
- Document text extraction (`/api/documents/:docId/extract-text`)
- Text-to-Speech (`/api/tts/generate`)
- Question Answering (`/api/qa/ask`)
- Audio file serving (`/api/audio/:audioId`)
- Health check (`/api/health`)

## Option 2: Docker Build (API Only)

### Step 1: Use the Provided Dockerfile

A `Dockerfile.api-only` is already provided in the `api/` directory. It includes all necessary dependencies (Poppler, build tools, etc.) without MySQL.

### Step 2: Build the Docker Image

```bash
cd api
docker build -f Dockerfile.api-only -t titan-academy-api:latest .
```

### Step 3: Run the Container

```bash
docker run -d \
  --name titan-academy-api \
  -p 3000:3002 \
  -e GEMINI_API_KEY=your_gemini_api_key_here \
  -e PORT=3002 \
  -e NODE_ENV=production \
  -v $(pwd)/media:/app/media \
  -v $(pwd)/temp:/app/temp \
  titan-academy-api:latest
```

### Step 4: Verify the Container

```bash
# Check logs
docker logs titan-academy-api

# Check if running
docker ps | grep titan-academy-api

# Test health endpoint
curl http://localhost:3000/api/health
```

## Option 3: Docker Compose (API Only)

### Step 1: Use the Provided docker-compose File

A `docker-compose.api-only.yml` file is already provided in the `api/` directory. It's configured to run only the API service without MySQL.

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api-only
    container_name: titan-academy-api-only
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3002"
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=3002
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      # No database configuration - API runs without MySQL
    volumes:
      - ./media:/app/media
      - ./temp:/app/temp
      - ./.env:/app/.env
    networks:
      - api-network

networks:
  api-network:
    driver: bridge
```

### Step 2: Start the Service

```bash
cd api
docker-compose -f docker-compose.api-only.yml up -d
```

### Step 3: View Logs

```bash
docker-compose -f docker-compose.api-only.yml logs -f api
```

## Testing the API

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

### Test Document Text Extraction

```bash
# First, upload a PDF via the admin interface or use an existing document
curl http://localhost:3000/api/documents/{docId}/extract-text
```

### Test TTS

```bash
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "voice": "Kore"
  }'
```

## Limitations Without MySQL

When running without MySQL, the following features will **not work**:

- ❌ User authentication (`/api/auth/login`, `/api/auth/register`)
- ❌ Course management (`/api/courses/*`)
- ❌ Chapter management (`/api/courses/:courseId/chapters/*`)
- ❌ Lab management (`/api/labs/*`)
- ❌ Exercise management (`/api/exercises/*`)
- ❌ Final project management (`/api/courses/:courseId/final-project/*`)
- ❌ User subscriptions (`/api/subscriptions/*`)

The following features **will work**:

- ✅ Document text extraction (`/api/documents/:docId/extract-text`)
- ✅ Text-to-Speech (`/api/tts/generate`)
- ✅ Question Answering (`/api/qa/ask`)
- ✅ Audio file serving (`/api/audio/:audioId`)
- ✅ Health check (`/api/health`)

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, change it in your `.env` file:

```env
PORT=3001
```

### Missing Directories

If you get errors about missing directories:

```bash
cd api
mkdir -p media temp
chmod -R 755 media temp
```

### Gemini API Key Not Set

If you see errors about missing API key:

```bash
# Check if it's set
echo $GEMINI_API_KEY

# Or in .env file
cat .env | grep GEMINI_API_KEY
```

### Docker Build Fails

If Docker build fails, ensure you're in the `api/` directory:

```bash
cd api
docker build -f Dockerfile.api-only -t titan-academy-api:latest .
```

## Production Deployment

For production deployment without MySQL:

1. Use a reverse proxy (nginx) in front of the API
2. Set up proper logging
3. Configure environment variables securely
4. Use process managers like PM2 for Node.js:

```bash
npm install -g pm2
pm2 start server.js --name titan-academy-api
pm2 save
pm2 startup
```

## Next Steps

- To add MySQL later, see [DOCKER_SETUP.md](./DOCKER_SETUP.md)
- For full production setup, see [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)
- For troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
