# Environment Variables Configuration

This document lists all environment variables used in the PDF to Voice API project.

## Quick Setup

1. Copy the template below to create your `.env` file
2. Fill in your API keys (at minimum, you need `GEMINI_API_KEY`)
3. Save the file as `.env` in the `api/` directory

## Environment Variables Template

```env
# ===========================================
# REQUIRED - Google Gemini API
# ===========================================
GEMINI_API_KEY=your_gemini_api_key_here

# ===========================================
# OPTIONAL - Server Configuration
# ===========================================
PORT=3000

# ===========================================
# OPTIONAL - Authentication Configuration
# ===========================================
ADMIN_EMAIL=admin@titanacademy.com
ADMIN_PASSWORD=admin123
SESSION_SECRET=titan-academy-secret-key-change-in-production

# ===========================================
# OPTIONAL - Email (SMTP) for Password Reset
# ===========================================
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Titan Academy <no-reply@titanacademy.com>"
FRONTEND_URL=http://localhost:4080
RESET_PASSWORD_URL=http://localhost:4080/reset-password

# ===========================================
# OPTIONAL - MySQL Database Configuration
# ===========================================
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=titan_academy
DB_CONNECTION_LIMIT=10

# ===========================================
# OPTIONAL - Free AI Alternatives (Recommended)
# ===========================================
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
FREE_AI_PROVIDER=groq,huggingface
USE_FREE_AI=true

# ===========================================
# OPTIONAL - File Upload Configuration
# ===========================================
MAX_FILE_SIZE=10485760

# ===========================================
# OPTIONAL - TTS Configuration
# ===========================================
TTS_TEXT_LIMIT=4000

# ===========================================
# OPTIONAL - Lip Sync / Rhubarb
# ===========================================
RHUBARB_PATH=C:\\Tools\\Rhubarb-Lip-Sync-1.14.0\\rhubarb.exe

# ===========================================
# OPTIONAL - Development
# ===========================================
NODE_ENV=development

# ===========================================
# OPTIONAL - Alternative TTS (Not Used Currently)
# ===========================================
VOICERSS_API_KEY=your_voicerss_api_key_here
```

---

## Required Variables

### `GEMINI_API_KEY` ⚠️ **REQUIRED**

**Description:** Google Gemini API key for AI text generation and TTS.

**How to get:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to `.env`

**Example:**
```env
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Note:** The application will not start without this key.

---

## Optional Variables

### Server Configuration

#### `PORT`
- **Default:** `3000`
- **Description:** Port number for the Express server
- **Example:** `PORT=3000`

#### `ALLOWED_ORIGINS`
- **Default:** `http://102.211.209.131:4080,http://localhost:4080,http://localhost:3000`
- **Description:** Comma-separated list of allowed CORS origins. Required when using credentials (cookies/sessions).
- **Note:** When `credentials: true` is used, you cannot use `*` as origin. Must specify exact origins.
- **Example:** `ALLOWED_ORIGINS=http://102.211.209.131:4080,http://localhost:4080`
- **Important:** Include your frontend URL(s) here to allow CORS requests with credentials

---

### Authentication Configuration

#### `ADMIN_EMAIL`
- **Default:** `admin@titanacademy.com`
- **Description:** Email address for accessing the course and chapter management interface
- **Example:** `ADMIN_EMAIL=admin@yourdomain.com`
- **Security Note:** Change this to your admin email in production

#### `ADMIN_PASSWORD`
- **Default:** `admin123`
- **Description:** Password for accessing the course and chapter management interface
- **Example:** `ADMIN_PASSWORD=your_secure_password_here`
- **Security Note:** Change this to a strong password in production

#### `SESSION_SECRET`
- **Default:** `titan-academy-secret-key-change-in-production`
- **Description:** Secret key used to sign session cookies. Should be a random, secure string
- **Example:** `SESSION_SECRET=your-random-secret-key-here`
- **Security Note:** Use a strong, random secret in production. Generate with: `openssl rand -base64 32`

---

### Email (SMTP) for Password Reset

These variables are required to send password reset emails.

#### `SMTP_HOST`
- **Description:** SMTP server host
- **Example:** `SMTP_HOST=smtp.gmail.com`

#### `SMTP_PORT`
- **Default:** `587`
- **Description:** SMTP server port
- **Example:** `SMTP_PORT=587`

#### `SMTP_SECURE`
- **Default:** `false`
- **Description:** Use TLS/SSL for SMTP
- **Example:** `SMTP_SECURE=true`

#### `SMTP_USER`
- **Description:** SMTP username
- **Example:** `SMTP_USER=your_smtp_user`

#### `SMTP_PASS`
- **Description:** SMTP password or app password
- **Example:** `SMTP_PASS=your_smtp_password`

#### `SMTP_FROM`
- **Description:** From address used in reset emails
- **Example:** `SMTP_FROM="Titan Academy <no-reply@titanacademy.com>"`

#### `FRONTEND_URL`
- **Description:** Base frontend URL used to build reset links
- **Example:** `FRONTEND_URL=http://localhost:4080`

#### `RESET_PASSWORD_URL`
- **Description:** Full reset password URL. Overrides `FRONTEND_URL` if set.
- **Example:** `RESET_PASSWORD_URL=https://app.example.com/reset-password`

---

### MySQL Database Configuration

#### `DB_HOST`
- **Default:** `localhost` (dev mode) or `mysql` (production/Docker)
- **Description:** MySQL database host address
- **Behavior:**
  - If `NODE_ENV=dev` or `NODE_ENV=development`: Always uses `localhost` (ignores this variable)
  - Otherwise: Uses this value or defaults to `mysql` (for Docker)
- **Example:** `DB_HOST=localhost` or `DB_HOST=127.0.0.1`

#### `DB_PORT`
- **Default:** `3307` (dev mode) or `3306` (production/Docker)
- **Description:** MySQL database port number
- **Behavior:**
  - If `NODE_ENV=dev` or `NODE_ENV=development`: Defaults to `3307` (external Docker port)
  - Otherwise: Defaults to `3306` (internal Docker port)
- **Example:** `DB_PORT=3307` (for local MySQL) or `DB_PORT=3306` (for Docker)

#### `DB_USER`
- **Default:** `root`
- **Description:** MySQL database username
- **Example:** `DB_USER=root`

#### `DB_PASSWORD`
- **Default:** `` (empty string)
- **Description:** MySQL database password
- **Example:** `DB_PASSWORD=your_password_here`

#### `DB_NAME`
- **Default:** `titan_academy`
- **Description:** MySQL database name
- **Example:** `DB_NAME=titan_academy`

#### `DB_CONNECTION_LIMIT`
- **Default:** `10`
- **Description:** Maximum number of connections in the connection pool
- **Example:** `DB_CONNECTION_LIMIT=10`

**Note:** The database connection is optional. If `DB_HOST` or `DB_NAME` are not set, the application will start without database functionality.

---

### Free AI Alternatives (Recommended for QA Endpoint)

These are **highly recommended** to avoid Google Gemini rate limits.

#### `GROQ_API_KEY`
- **Required:** Only if using Groq for free AI
- **Description:** Groq API key for fast, free AI responses
- **How to get:** [Groq Console](https://console.groq.com)
- **Free Tier:** 14,400 requests/day
- **Example:** `GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### `GROQ_MODEL`
- **Default:** `llama-3.1-8b-instant`
- **Description:** Groq model to use
- **Options:**
  - `llama-3.1-8b-instant` (fastest)
  - `llama-3.1-70b-versatile` (more capable)
  - `mixtral-8x7b-32768` (balanced)
- **Example:** `GROQ_MODEL=llama-3.1-8b-instant`

#### `HUGGINGFACE_API_KEY`
- **Required:** Only if using Hugging Face for free AI
- **Description:** Hugging Face API token
- **How to get:** [Hugging Face Settings](https://huggingface.co/settings/tokens)
- **Free Tier:** Unlimited for open models
- **Example:** `HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### `HF_MODEL`
- **Default:** `mistralai/Mistral-7B-Instruct-v0.2`
- **Description:** Hugging Face model to use
- **Options:**
  - `mistralai/Mistral-7B-Instruct-v0.2`
  - `meta-llama/Llama-2-7b-chat-hf`
  - Other compatible models
- **Example:** `HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2`

#### `FREE_AI_PROVIDER`
- **Default:** `groq,huggingface`
- **Description:** Comma-separated list of free AI providers to try (in order)
- **Options:** `groq`, `huggingface`
- **Example:** `FREE_AI_PROVIDER=groq,huggingface`

#### `USE_FREE_AI`
- **Default:** `true`
- **Description:** Enable/disable free AI for QA endpoint
- **Options:** `true`, `false`
- **Note:** Set to `false` to always use Google Gemini (may hit rate limits)
- **Example:** `USE_FREE_AI=true`

---

### File Upload Configuration

#### `MAX_FILE_SIZE`
- **Default:** `10485760` (10MB)
- **Description:** Maximum file size in bytes for PDF uploads
- **Example:** `MAX_FILE_SIZE=10485760` (10MB)
- **Note:** Value must be in bytes

---

### TTS Configuration

#### `TTS_TEXT_LIMIT`
- **Default:** `4000`
- **Description:** Maximum characters for TTS generation (text is truncated if longer)
- **Example:** `TTS_TEXT_LIMIT=4000`

---

### Lip Sync / Rhubarb

#### `RHUBARB_PATH`
- **Default:** Auto-detected in this order:
  1. Environment variable `RHUBARB_PATH` (if set)
  2. Local libsync folder: `<project>/api/libsync/rhubarb(.exe)` (if exists)
  3. Production Docker volume: `/var/lib/docker/volumes/rhubarb-lip-sync/rhubarb` (if exists)
  4. Local bin directory: `<project>/api/bin/Rhubarb-Lip-Sync-1.14.0/rhubarb(.exe)` (if exists)
- **Description:** Absolute path to the Rhubarb-Lip-Sync executable used to create mouth cue JSON files.
- **When required:** When using the admin UI button "Lip Sync" to generate visemes for a course.
- **Example (Windows):** `RHUBARB_PATH=C:\Tools\Rhubarb-Lip-Sync-1.14.0\rhubarb.exe`
- **Example (macOS/Linux):** `RHUBARB_PATH=/usr/local/bin/rhubarb`
- **Example (Production Docker Linux):** `RHUBARB_PATH=/var/lib/docker/volumes/rhubarb-lip-sync/rhubarb` (auto-detected if volume exists)
- **Example (Production Docker Windows):** `RHUBARB_PATH=/var/lib/docker/volumes/rhubarb-lip-sync/rhubarb.exe` (auto-detected if volume exists)
- **Notes:** Download Rhubarb 1.14.0 from [https://github.com/DanielSWolf/rhubarb-lip-sync/releases](https://github.com/DanielSWolf/rhubarb-lip-sync/releases) and ensure the executable has run permission. The production Docker volume path is automatically detected if present. On Linux servers, it will look for the Linux executable (`rhubarb`), and on Windows it will look for `rhubarb.exe`.

---

### Development/Production

#### `NODE_ENV`
- **Default:** Not set
- **Description:** Environment mode
- **Options:** `dev`, `development`, `production`
- **Effect:** 
  - `dev` or `development`: 
    - Shows detailed error stack traces
    - **Forces database connection to `localhost`** (ignores `DB_HOST`)
    - Uses external port `3307` by default (for local MySQL)
  - `production`: 
    - Hides stack traces for security
    - Uses `DB_HOST` from environment or defaults to `mysql` (Docker service name)
    - Uses internal port `3306` by default
- **Example:** `NODE_ENV=dev` or `NODE_ENV=development`

---

### Alternative TTS (Currently Unused)

#### `VOICERSS_API_KEY`
- **Required:** Only if using Voice RSS TTS (not currently used)
- **Description:** Voice RSS API key
- **How to get:** [Voice RSS](https://www.voicerss.org/api/)
- **Note:** The project currently uses Edge TTS (free) or Gemini TTS
- **Example:** `VOICERSS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Complete `.env` File Example

```env
# REQUIRED
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Server
PORT=3000

# Authentication (Optional)
ADMIN_EMAIL=admin@titanacademy.com
ADMIN_PASSWORD=admin123
SESSION_SECRET=titan-academy-secret-key-change-in-production

# MySQL Database (Optional)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=titan_academy
DB_CONNECTION_LIMIT=10

# Free AI (Recommended)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
FREE_AI_PROVIDER=groq,huggingface
USE_FREE_AI=true

# File Upload
MAX_FILE_SIZE=10485760

# TTS
TTS_TEXT_LIMIT=4000

# Development
NODE_ENV=development
```

---

## Minimum Configuration

For basic functionality, you only need:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

However, to avoid rate limits on the QA endpoint, it's recommended to also add:

```env
GROQ_API_KEY=your_groq_api_key_here
USE_FREE_AI=true
```

---

## Security Notes

⚠️ **Important:**
- Never commit your `.env` file to version control
- Keep your API keys secure and private
- The `.env` file should be in `.gitignore`
- Do not share your API keys publicly

---

## Troubleshooting

### "GEMINI_API_KEY environment variable is not set"
- Make sure `.env` file exists in the `api/` directory
- Check that `GEMINI_API_KEY` is set correctly
- Restart the server after adding/changing `.env`

### Free AI not working
- Check that `GROQ_API_KEY` or `HUGGINGFACE_API_KEY` is set
- Verify `USE_FREE_AI=true` (or not set, defaults to true)
- Check API key validity

### Rate limit errors
- Add Groq API key: `GROQ_API_KEY=your_key`
- Ensure `USE_FREE_AI=true`
- The system will automatically use free AI services first

---

## Variable Reference Table

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | - | Google Gemini API key |
| `PORT` | No | `3000` | Server port |
| `ADMIN_EMAIL` | No | `admin@titanacademy.com` | Admin email for login |
| `ADMIN_PASSWORD` | No | `admin123` | Admin password for login |
| `SESSION_SECRET` | No | `titan-academy-secret-key...` | Session cookie secret |
| `DB_HOST` | No | `localhost` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | No | `root` | MySQL username |
| `DB_PASSWORD` | No | `` | MySQL password |
| `DB_NAME` | No | `titan_academy` | MySQL database name |
| `DB_CONNECTION_LIMIT` | No | `10` | Connection pool limit |
| `GROQ_API_KEY` | No* | - | Groq API key (recommended) |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Groq model |
| `HUGGINGFACE_API_KEY` | No* | - | Hugging Face API key |
| `HF_MODEL` | No | `mistralai/Mistral-7B-Instruct-v0.2` | Hugging Face model |
| `FREE_AI_PROVIDER` | No | `groq,huggingface` | Provider priority |
| `USE_FREE_AI` | No | `true` | Enable free AI |
| `MAX_FILE_SIZE` | No | `10485760` | Max file size (bytes) |
| `TTS_TEXT_LIMIT` | No | `4000` | TTS character limit |
| `NODE_ENV` | No | - | Environment mode |
| `VOICERSS_API_KEY` | No | - | Voice RSS API key (unused) |

*Required only if using that specific free AI service

