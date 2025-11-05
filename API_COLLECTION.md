# API Endpoints Collection

**Base URL:** `http://localhost:3000` (or your configured port)

---

## 📋 Table of Contents

1. [Health Check](#health-check)
2. [Document Management](#document-management)
3. [Text-to-Speech (TTS)](#text-to-speech-tts)
4. [Question Answering (QA)](#question-answering-qa)
5. [Audio Files](#audio-files)
6. [Static Routes](#static-routes)

---

## 🔍 Health Check

### GET `/api/health`

Check server status and version.

**Parameters:** None

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

## 📄 Document Management

### GET `/api/documents`

Get list of all documents with metadata.

**Parameters:** None

**Response:**
```json
[
  {
    "id": "4ff58535-e232-47cb-b812-ad5a04793aa3",
    "title": "document-title",
    "filename": "4ff58535-e232-47cb-b812-ad5a04793aa3.pdf",
    "length": 1234,
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
]
```

**Example:**
```bash
curl http://localhost:3000/api/documents
```

---

### POST `/api/documents`

Upload a PDF file and extract text.

**Content-Type:** `multipart/form-data`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pdfFile` | File | ✅ Yes | PDF file to upload (max 10MB) |

**Validation:**
- File must be PDF format (`.pdf` extension)
- File size must be ≤ 10MB
- MIME type must be `application/pdf`

**Response:**
```json
{
  "text": "Extracted text from PDF...",
  "docId": "4ff58535-e232-47cb-b812-ad5a04793aa3",
  "filename": "4ff58535-e232-47cb-b812-ad5a04793aa3.pdf"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/documents \
  -F "pdfFile=@document.pdf"
```

**JavaScript (fetch):**
```javascript
const formData = new FormData();
formData.append('pdfFile', fileInput.files[0]);

fetch('http://localhost:3000/api/documents', {
  method: 'POST',
  body: formData
})
.then(res => res.json())
.then(data => console.log(data));
```

---

### GET `/api/documents/:docId/file`

Get PDF file by document ID.

**Parameters:**
| Parameter | Type | Required | Location | Description |
|-----------|------|----------|----------|-------------|
| `docId` | String (UUID) | ✅ Yes | URL Path | Document ID |

**Response:** PDF file (binary)

**Example:**
```bash
curl http://localhost:3000/api/documents/4ff58535-e232-47cb-b812-ad5a04793aa3/file \
  --output document.pdf
```

**Direct URL:**
```
http://localhost:3000/uploads/4ff58535-e232-47cb-b812-ad5a04793aa3.pdf
```

---

### GET `/api/documents/:docId/summary`

Generate or retrieve document summary with audio.

**Parameters:**
| Parameter | Type | Required | Location | Description |
|-----------|------|----------|----------|-------------|
| `docId` | String (UUID) | ✅ Yes | URL Path | Document ID |
| `language` | String | ❌ No | Query | Language code (`en`, `fr`, `es`, `de`, `it`, `pt`). Default: `fr` |

**Response:**
```json
{
  "docId": "4ff58535-e232-47cb-b812-ad5a04793aa3",
  "summary": "Résumé du document en français...",
  "audioData": "base64-encoded-audio-data",
  "mimeType": "audio/wav",
  "originalLength": 5000,
  "summaryLength": 500,
  "type": "summary",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Examples:**
```bash
# French summary (default)
curl http://localhost:3000/api/documents/4ff58535-e232-47cb-b812-ad5a04793aa3/summary

# English summary
curl http://localhost:3000/api/documents/4ff58535-e232-47cb-b812-ad5a04793aa3/summary?language=en
```

---

### GET `/api/documents/:docId/summary/audio`

Generate or retrieve audio from document summary.

**Parameters:**
| Parameter | Type | Required | Location | Description |
|-----------|------|----------|----------|-------------|
| `docId` | String (UUID) | ✅ Yes | URL Path | Document ID |
| `language` | String | ❌ No | Query | Language code (`en`, `fr`, `es`, `de`, `it`, `pt`). Default: `fr` |

**Response:**
```json
{
  "audioData": "base64-encoded-audio-data",
  "mimeType": "audio/wav",
  "docId": "4ff58535-e232-47cb-b812-ad5a04793aa3",
  "summary": "Résumé du document...",
  "type": "summary"
}
```

**Example:**
```bash
curl http://localhost:3000/api/documents/4ff58535-e232-47cb-b812-ad5a04793aa3/summary/audio?language=fr
```

---

## 🔊 Text-to-Speech (TTS)

### POST `/api/tts`

Generate TTS audio from document text.

**Content-Type:** `application/json`

**Parameters:**
| Parameter | Type | Required | Location | Description |
|-----------|------|----------|----------|-------------|
| `docId` | String (UUID) | ✅ Yes | Body | Document ID |

**Request Body:**
```json
{
  "docId": "4ff58535-e232-47cb-b812-ad5a04793aa3"
}
```

**Response:**
```json
{
  "docId": "4ff58535-e232-47cb-b812-ad5a04793aa3",
  "audioData": "base64-encoded-audio-data",
  "mimeType": "audio/wav",
  "textLength": 5000,
  "audioLength": 123456,
  "cached": false
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"docId": "4ff58535-e232-47cb-b812-ad5a04793aa3"}'
```

---

## ❓ Question Answering (QA)

### POST `/api/qa`

Answer general knowledge questions with AI and generate audio.

**Content-Type:** `application/json`

**Parameters:**
| Parameter | Type | Required | Location | Description |
|-----------|------|----------|----------|-------------|
| `question` | String | ✅ Yes | Body | Question to answer (3-1000 chars) |
| `useFreeAI` | Boolean | ❌ No | Body | Use free AI services (Groq/Hugging Face) instead of Google Gemini. Default: `true` |

**Request Body:**
```json
{
  "question": "Qu'est-ce que l'intelligence artificielle?",
  "useFreeAI": true
}
```

**Response:**
```json
{
  "answer": "L'intelligence artificielle (IA) est...",
  "audioUrl": "/api/audio/qa-4ff58535-e232-47cb-b812-ad5a04793aa3",
  "provider": "free"
}
```

**Examples:**
```bash
# Using free AI (default)
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "Qu'est-ce que l'intelligence artificielle?"}'

# Using Google Gemini
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "What is artificial intelligence?", "useFreeAI": false}'
```

**Note:** QA responses are always in French (matching the system prompt). Audio is generated in French using Edge TTS.

---

## 🎵 Audio Files

### GET `/api/audio/:audioId`

Serve audio file by audio ID.

**Parameters:**
| Parameter | Type | Required | Location | Description |
|-----------|------|----------|----------|-------------|
| `audioId` | String | ✅ Yes | URL Path | Audio file ID (max 200 chars) |

**Response:** WAV audio file (binary)

**Content-Type:** `audio/wav`

**Example:**
```bash
curl http://localhost:3000/api/audio/qa-4ff58535-e232-47cb-b812-ad5a04793aa3 \
  --output audio.wav
```

**Direct URL:**
```
http://localhost:3000/audios/qa-4ff58535-e232-47cb-b812-ad5a04793aa3.wav
```

**Audio ID Formats:**
- Summary audio: `{docId}-summary`
- QA audio: `qa-{uuid}`
- Document TTS: `{docId}`

---

## 📁 Static Routes

These routes serve files directly without API processing:

### `/uploads/:filename`

Serve PDF files directly.

**Example:**
```
http://localhost:3000/uploads/4ff58535-e232-47cb-b812-ad5a04793aa3.pdf
```

### `/audios/:filename`

Serve audio files directly.

**Example:**
```
http://localhost:3000/audios/4ff58535-e232-47cb-b812-ad5a04793aa3-summary.wav
```

---

## 🔒 Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "details": "Detailed error information (optional)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found (document/audio not found)
- `500` - Internal Server Error

**Common Error Messages:**
- `"No PDF file uploaded"` - Missing PDF file in upload
- `"Only PDF files are allowed"` - Invalid file type
- `"File size exceeds the maximum limit"` - File too large (>10MB)
- `"Document not found"` - Document ID doesn't exist
- `"Document ID is required"` - Missing docId parameter
- `"Valid question is required"` - Missing or invalid question
- `"Audio file not found"` - Audio ID doesn't exist

---

## 📝 Notes

1. **Language Support:**
   - Summary endpoint defaults to French (`fr`)
   - Supported languages: `en`, `fr`, `es`, `de`, `it`, `pt`
   - QA responses are always in French

2. **Caching:**
   - Summaries are cached by document ID and language
   - TTS audio is cached by document ID
   - Summary audio is cached separately

3. **File Limits:**
   - PDF files: Max 10MB
   - Question length: 3-1000 characters
   - TTS text limit: 4000 characters (auto-truncated)

4. **Audio Format:**
   - All audio is returned as WAV format
   - Sample rate: 24000 Hz
   - Channels: 1 (mono)
   - Bits per sample: 16

5. **AI Providers:**
   - Default: Free AI (Groq/Hugging Face) for QA
   - Fallback: Google Gemini
   - TTS: Edge TTS (free) with Gemini TTS fallback

---

## 🧪 Testing Examples

### Complete Workflow

```bash
# 1. Upload a PDF
curl -X POST http://localhost:3000/api/documents \
  -F "pdfFile=@document.pdf"

# Response: {"docId": "abc-123", "text": "...", "filename": "abc-123.pdf"}

# 2. Get document list
curl http://localhost:3000/api/documents

# 3. Get summary with audio
curl http://localhost:3000/api/documents/abc-123/summary

# 4. Generate TTS for full document
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"docId": "abc-123"}'

# 5. Ask a question
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "Qu'est-ce que la machine learning?"}'
```

---

## 📦 Postman Collection

See `API_COLLECTION.postman.json` for a ready-to-import Postman collection.

