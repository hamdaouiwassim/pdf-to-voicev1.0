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

### Development/Production

#### `NODE_ENV`
- **Default:** Not set
- **Description:** Environment mode
- **Options:** `development`, `production`
- **Effect:** 
  - `development`: Shows detailed error stack traces
  - `production`: Hides stack traces for security
- **Example:** `NODE_ENV=development`

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

