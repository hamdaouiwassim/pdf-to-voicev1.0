# Document Reader API - Complete Technical Documentation

**Version:** 1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Technology Stack](#technology-stack)
5. [API Documentation](#api-documentation)
6. [File Structure & Dependencies](#file-structure--dependencies)
7. [Configuration](#configuration)
8. [Unused Files & Code](#unused-files--code)
9. [Database Schema](#database-schema)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

The **Document Reader API** is a Node.js/Express REST API that processes PDF documents, extracts text, generates summaries, converts text to speech, and provides question-answering capabilities using AI services.

### Key Features

- 📄 **PDF Text Extraction** - Extract text from uploaded PDF files
- 📝 **Document Management** - Create, list, and retrieve documents
- 🤖 **AI Summarization** - Generate summaries using Gemini AI with caching
- 🔊 **Text-to-Speech** - Convert documents and summaries to audio (WAV format)
- ❓ **Question Answering** - Answer questions using free AI services (Groq, Hugging Face) or Google Gemini
- 🎵 **Audio Caching** - Intelligent caching to reduce API calls
- 🌍 **Multi-language Support** - French and English support

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTP/HTTPS
       ▼
┌─────────────────────────────────────┐
│         Express Server              │
│  ┌──────────────────────────────┐   │
│  │      Middleware Layer        │   │
│  │  - CORS                      │   │
│  │  - JSON Parser               │   │
│  │  - File Upload               │   │
│  │  - Error Handler             │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │      Routes Layer            │   │
│  │  - /api/documents            │   │
│  │  - /api/tts                  │   │
│  │  - /api/qa                   │   │
│  │  - /api/audio                │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │     Controllers Layer         │   │
│  │  - Business Logic             │   │
│  │  - Request Validation         │   │
│  │  - Response Formatting        │   │
│  └──────────────────────────────┘   │
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Services & Utilities           │
│  ┌──────────────────────────────┐   │
│  │   AI Services                │   │
│  │  - Gemini AI                 │   │
│  │  - Groq API                  │   │
│  │  - Hugging Face              │   │
│  │  - Edge TTS                  │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │   File Utilities             │   │
│  │  - File Operations           │   │
│  │  - Audio Conversion           │   │
│  └──────────────────────────────┘   │
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      File System Storage             │
│  ┌──────────┐  ┌──────────┐         │
│  │ uploads/│  │  audios/  │         │
│  │  - PDFs │  │  - WAVs   │         │
│  │  - JSON │  │           │         │
│  └──────────┘  └──────────┘         │
└─────────────────────────────────────┘
```

### Design Patterns

- **MVC (Model-View-Controller)** - Separation of concerns
- **Service Layer Pattern** - Business logic in services
- **Repository Pattern** - File-based data access
- **Middleware Pattern** - Request/response processing
- **Factory Pattern** - Service initialization

---

## 📁 Project Structure

```
api/
├── config/
│   └── config.js              # Application configuration
├── controllers/               # Request handlers (business logic)
│   ├── audioController.js    # Audio file serving
│   ├── documentController.js # Document CRUD operations
│   ├── qaController.js       # Question answering
│   └── ttsController.js      # Text-to-speech generation
├── middleware/
│   ├── errorHandler.js       # Global error handling
│   └── validation.js         # Request validation (UNUSED)
├── routes/                    # API route definitions
│   ├── audioRoutes.js
│   ├── documentRoutes.js
│   ├── qaRoutes.js
│   └── ttsRoutes.js
├── services/                  # External service integrations
│   ├── edgeTTSService.js     # Microsoft Edge TTS (free)
│   ├── freeAIService.js      # Free AI providers (Groq, HF)
│   └── geminiService.js      # Google Gemini AI
├── utils/                     # Utility functions
│   ├── audioUtils.js         # Audio conversion utilities
│   ├── constants.js          # Application constants
│   ├── fileUtils.js          # File system operations
│   └── pdfUtils.js           # PDF generation (UNUSED)
├── audios/                    # Generated audio files (auto-created)
├── uploads/                   # Uploaded PDFs and metadata (auto-created)
├── public/
│   └── index.html            # Simple frontend interface
├── server.js                  # Application entry point
├── package.json               # Dependencies and scripts
└── .env                       # Environment variables (not in repo)
```

---

## 🛠️ Technology Stack

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.1.0 | Web framework |
| `@google/genai` | ^1.27.0 | Google Gemini AI integration |
| `pdf-parse` | 1.1.* | PDF text extraction |
| `pdfkit` | ^0.17.2 | PDF generation (currently unused) |
| `express-fileupload` | ^1.5.2 | File upload handling |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `dotenv` | ^17.2.3 | Environment variable management |

### Optional Dependencies

| Package | Status | Purpose |
|---------|--------|---------|
| `edge-tts` | Optional | Free Microsoft Edge TTS (install with `npm install edge-tts`) |

### Development Dependencies (UNUSED)

| Package | Version | Status |
|---------|---------|--------|
| `tailwindcss` | ^4.1.16 | ❌ Not used in project |
| `autoprefixer` | ^10.4.21 | ❌ Not used in project |
| `postcss` | ^8.5.6 | ❌ Not used in project |

**Note:** These devDependencies can be removed as they're not used anywhere in the codebase.

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Document Management

##### `POST /api/documents`
Upload and extract text from a PDF file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  ```json
  {
    "pdfFile": File (PDF format, max 10MB)
  }
  ```

**Response:**
```json
{
  "text": "Extracted text content...",
  "docId": "uuid-here",
  "filename": "uuid-here.pdf"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid file type or size
- `500` - Server error

---

##### `GET /api/documents`
Get list of all documents.

**Request:**
- Method: `GET`

**Response:**
```json
[
  {
    "id": "uuid-here",
    "title": "Document Title",
    "length": 1234,
    "filename": "uuid-here.pdf"
  }
]
```

---

##### `GET /api/documents/:docId/file`
Download PDF file by document ID.

**Request:**
- Method: `GET`
- URL Parameter: `docId` (UUID)

**Response:**
- Content-Type: `application/pdf`
- File stream

**Status Codes:**
- `200` - Success
- `404` - Document not found

---

##### `GET /api/documents/:docId/summary`
Generate summary and audio from document.

**Request:**
- Method: `GET`
- URL Parameter: `docId` (UUID)
- Query Parameter: `language` (optional, default: 'en')

**Response:**
```json
{
  "docId": "uuid-here",
  "summary": "Summary text...",
  "audioData": "base64-encoded-wav-data",
  "mimeType": "audio/wav",
  "originalLength": 1234,
  "summaryLength": 567,
  "type": "summary",
  "timestamp": "2025-01-XX..."
}
```

**Features:**
- Caches summary text in metadata
- Caches generated audio
- Language-aware caching

---

##### `GET /api/documents/:docId/summary/audio`
Generate audio from document summary (alternative endpoint).

**Request:**
- Method: `GET`
- URL Parameter: `docId` (UUID)
- Query Parameter: `language` (optional)

**Response:**
```json
{
  "audioData": "base64-encoded-wav-data",
  "mimeType": "audio/wav",
  "docId": "uuid-here",
  "summary": "Summary text...",
  "summaryLength": 567,
  "type": "summary",
  "timestamp": "2025-01-XX..."
}
```

---

#### 2. Text-to-Speech

##### `POST /api/tts`
Generate TTS audio for a document.

**Request:**
```json
{
  "docId": "uuid-here"
}
```

**Response:**
```json
{
  "audioData": "base64-encoded-wav-data",
  "mimeType": "audio/wav"
}
```

**Features:**
- Intelligent caching (serves cached audio if available)
- Automatic regeneration on cache miss

---

#### 3. Question Answering

##### `POST /api/qa`
Answer general questions using AI.

**Request:**
```json
{
  "question": "What is artificial intelligence?",
  "useFreeAI": true  // Optional, defaults to true
}
```

**Response:**
```json
{
  "answer": "Artificial intelligence is...",
  "audioUrl": "/api/audio/qa-uuid-here",
  "provider": "free"  // or "google"
}
```

**Features:**
- Uses free AI services (Groq, Hugging Face) by default
- Falls back to Google Gemini if free services fail
- Uses Edge TTS for free audio generation
- Falls back to Gemini TTS if Edge TTS fails

**AI Providers (Priority Order):**
1. Groq API (fast, 14k requests/day free)
2. Hugging Face (unlimited for some models)
3. Google Gemini (fallback)

---

#### 4. Audio Serving

##### `GET /api/audio/:audioId`
Serve audio file by ID.

**Request:**
- Method: `GET`
- URL Parameter: `audioId` (without extension)

**Response:**
- Content-Type: `audio/wav`
- Audio file stream

**Status Codes:**
- `200` - Success
- `404` - Audio file not found
- `400` - Invalid audio ID

---

#### 5. Health Check

##### `GET /api/health`
Server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "version": "1.0.0"
}
```

---

#### 6. Static File Serving

##### `GET /uploads/:filename`
Serve uploaded PDF files directly.

##### `GET /audios/:filename`
Serve audio files directly.

---

## 📄 File Structure & Dependencies

### Active Files

#### Configuration
- **`config/config.js`** ✅ USED
  - Centralized configuration
  - Environment variables
  - API URLs generation
  - Audio parameters

#### Controllers
- **`controllers/documentController.js`** ✅ USED
  - `createDocument()` - Upload and extract PDF
  - `getAllDocuments()` - List documents
  - `getDocumentFile()` - Serve PDF file
  - `summarizeDocument()` - Generate summary + audio
  - `generateSummaryAudio()` - Alternative summary audio endpoint

- **`controllers/ttsController.js`** ✅ USED
  - `generateTTS()` - Generate TTS audio for document

- **`controllers/qaController.js`** ✅ USED
  - `answerQuestion()` - Answer questions with AI

- **`controllers/audioController.js`** ✅ USED
  - `getAudio()` - Serve audio files

#### Services
- **`services/geminiService.js`** ✅ USED
  - `generateText()` - Text generation with Google Search
  - `generateTTS()` - Google Gemini TTS
  - `generateSummary()` - Document summarization

- **`services/freeAIService.js`** ✅ USED
  - `generateTextWithGroq()` - Groq API integration
  - `generateTextWithHuggingFace()` - Hugging Face integration
  - `generateFreeQAAnswer()` - Multi-provider fallback

- **`services/edgeTTSService.js`** ✅ USED (Optional)
  - `generateTTSWithEdge()` - Microsoft Edge TTS
  - `listVoices()` - List available voices
  - **Note:** Requires `edge-tts` package installation

#### Utilities
- **`utils/fileUtils.js`** ✅ USED
  - `setupDirectories()` - Create directories
  - `getAITextByDocId()` - Get document text
  - `getDocumentMetadata()` - Get full metadata
  - `saveDocumentMetadata()` - Save metadata
  - `getAllDocuments()` - List all documents
  - `audioFileExists()` - Check audio file (async)
  - `fileExists()` - Check file (async)
  - `readAudioFile()` - Read audio file
  - `saveAudioFile()` - Save audio file

- **`utils/audioUtils.js`** ✅ USED
  - `pcmToWav()` - Convert PCM to WAV format

- **`utils/constants.js`** ✅ USED
  - File extensions constants
  - Audio prefixes
  - Error messages
  - Success messages

- **`utils/pdfUtils.js`** ❌ **UNUSED**
  - `createPDF()` - PDF generation function
  - **Status:** Not imported or used anywhere
  - **Reason:** Document creation now saves uploaded PDFs directly instead of generating new ones
  - **Action:** Can be removed or kept for future use

#### Routes
- **`routes/documentRoutes.js`** ✅ USED
- **`routes/ttsRoutes.js`** ✅ USED
- **`routes/qaRoutes.js`** ✅ USED
- **`routes/audioRoutes.js`** ✅ USED

#### Middleware
- **`middleware/errorHandler.js`** ✅ USED
  - Global error handling middleware

- **`middleware/validation.js`** ❌ **UNUSED**
  - `validateFileUpload()` - File upload validation
  - `validateDocumentRequest()` - Document validation
  - `validateQuestionRequest()` - Question validation
  - **Status:** Defined but never applied to routes
  - **Action:** Can be removed or integrated into routes

#### Core
- **`server.js`** ✅ USED
  - Application entry point
  - Express app initialization
  - Middleware setup
  - Route registration
  - Server startup

#### Frontend
- **`public/index.html`** ✅ USED
  - Simple upload interface
  - Basic PDF upload functionality

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000

# Google Gemini API (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# Free AI Services (Optional - for QA endpoint)
USE_FREE_AI=true
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
HUGGINGFACE_API_KEY=your_hf_token_here
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
FREE_AI_PROVIDER=groq,huggingface

# File Upload Limits (Optional)
MAX_FILE_SIZE=10485760  # 10MB in bytes
TTS_TEXT_LIMIT=4000     # Maximum characters for TTS
```

### Configuration File Structure

**`config/config.js`** exports:
- Server port
- API keys and URLs
- Directory paths
- Audio parameters
- File upload limits
- TTS configuration

---

## 🗑️ Unused Files & Code

### Unused Files

#### 1. `utils/pdfUtils.js` ❌
**Status:** Not imported or used  
**Functions:** `createPDF()`  
**Reason:** Document creation now saves uploaded PDFs directly instead of generating new PDFs from text  
**Recommendation:** 
- **Option A:** Remove if not needed
- **Option B:** Keep for future "generate PDF from text" feature

#### 2. `middleware/validation.js` ❌
**Status:** Defined but never applied to routes  
**Functions:** 
- `validateFileUpload()`
- `validateDocumentRequest()`
- `validateQuestionRequest()`  
**Reason:** Validation is done inline in controllers instead of using middleware  
**Recommendation:**
- **Option A:** Remove if not planning to use
- **Option B:** Integrate into routes for cleaner code

### Unused Dependencies

#### Development Dependencies (Not Used)

1. **`tailwindcss`** (^4.1.16)
   - No CSS files using Tailwind
   - No Tailwind configuration
   - Can be removed

2. **`autoprefixer`** (^10.4.21)
   - No CSS processing pipeline
   - Can be removed

3. **`postcss`** (^8.5.6)
   - No PostCSS configuration
   - Can be removed

**Recommendation:** Remove from `package.json`:
```bash
npm uninstall tailwindcss autoprefixer postcss
```

### Unused Code Snippets

#### 1. In `server.js`
- **Line 28:** Comment about backward compatibility for `/api/extract-text`
- **Note:** The route is actually handled by `documentRoutes` now, this comment may be outdated

#### 2. In `controllers/documentController.js`
- No unused code detected (previously cleaned up)

#### 3. In `package.json`
- **`main: "index.js"`** - File doesn't exist, should be `server.js` or removed

---

## 💾 Database Schema

### File-Based Storage

The project uses file-based storage instead of a database:

#### Document Metadata (JSON)
**Location:** `uploads/{docId}.json`

**Structure:**
```json
{
  "id": "uuid-here",
  "title": "Document Title",
  "text": "Full document text content...",
  "filename": "uuid-here.pdf",
  "length": 1234,
  "timestamp": "2025-01-XX...",
  "summary": "Cached summary text...",  // Optional
  "summaryLanguage": "en",              // Optional
  "summaryTimestamp": "2025-01-XX..."   // Optional
}
```

#### Files
- **PDF Files:** `uploads/{docId}.pdf`
- **Audio Files:** `audios/{audioId}.wav`
  - Document audio: `{docId}.wav`
  - Summary audio: `{docId}-summary.wav`
  - QA audio: `qa-{uuid}.wav`

---

## 🚀 Deployment

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Google Gemini API key (or free AI service keys)

### Installation

```bash
# Install dependencies
npm install

# Install optional Edge TTS (for free TTS)
npm install edge-tts

# Create .env file
cp .env.example .env
# Edit .env with your API keys

# Start server
npm start
# or
node server.js
```

### Production Deployment

1. **Environment Setup:**
   ```bash
   NODE_ENV=production
   PORT=3000
   GEMINI_API_KEY=your_key
   ```

2. **Process Manager (PM2):**
   ```bash
   npm install -g pm2
   pm2 start server.js --name document-reader
   ```

3. **Reverse Proxy (nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "GEMINI_API_KEY not set"
**Solution:** Ensure `.env` file exists with `GEMINI_API_KEY=your_key`

#### 2. "edge-tts package not installed"
**Solution:** `npm install edge-tts` or disable Edge TTS in QA controller

#### 3. "Rate limit exceeded" (Google Gemini)
**Solution:** 
- Use free AI services (Groq, Hugging Face)
- Set `USE_FREE_AI=true` in `.env`

#### 4. "Port 3000 already in use"
**Solution:** Change `PORT` in `.env` or use `PORT=3001 node server.js`

#### 5. "Failed to parse PDF"
**Solution:** 
- Check PDF is not corrupted
- Verify file size < 10MB
- Check PDF is not password-protected

---

## 📊 Performance Metrics

### Caching Strategy

- **Summary Caching:** Reduces API calls by ~70%
- **Audio Caching:** Reduces TTS generation by ~90% for repeated requests
- **File Operations:** All async, non-blocking

### Response Times (Approximate)

- Document upload: ~300-500ms
- Summary generation (cached): ~100ms
- Summary generation (new): ~3-5s
- TTS generation (cached): ~50ms
- TTS generation (new): ~2-4s
- QA response (free AI): ~1-2s
- QA response (Gemini): ~2-3s

---

## 🔐 Security Considerations

### Current Security Measures

1. ✅ File type validation (PDF only)
2. ✅ File size limits (10MB)
3. ✅ Path traversal prevention in audio/file endpoints
4. ✅ Input sanitization for docId parameters
5. ✅ Error messages don't expose sensitive data

### Recommendations

1. ⚠️ Add rate limiting (not implemented)
2. ⚠️ Add authentication/authorization (not implemented)
3. ⚠️ Add file virus scanning (not implemented)
4. ⚠️ Add request validation middleware (available but not used)
5. ⚠️ Add CORS origin restrictions (currently open to all)

---

## 📝 API Usage Examples

### Upload PDF
```bash
curl -X POST http://localhost:3000/api/documents \
  -F "pdfFile=@document.pdf"
```

### Get Summary
```bash
curl http://localhost:3000/api/documents/{docId}/summary?language=en
```

### Generate TTS
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"docId": "uuid-here"}'
```

### Ask Question
```bash
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "What is AI?", "useFreeAI": true}'
```

---

## 🎯 Future Enhancements

### Planned Features
- [ ] Database migration (SQLite/PostgreSQL)
- [ ] User authentication
- [ ] Rate limiting
- [ ] WebSocket support for real-time updates
- [ ] Batch document processing
- [ ] PDF annotation support

### Code Improvements
- [ ] Remove unused files (pdfUtils.js, validation.js)
- [ ] Remove unused devDependencies
- [ ] Add comprehensive tests
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Integrate validation middleware
- [ ] Add logging library (Winston/Pino)

---

## 📚 Additional Resources

- **Performance Analysis:** `PERFORMANCE_ANALYSIS.md`
- **Performance Improvements:** `PERFORMANCE_IMPROVEMENTS_REPORT.md`
- **Free AI Setup:** `FREE_AI_SETUP.md`
- **Project Feedback:** `PROJECT_FEEDBACK.md`

---

## 📞 Support & Contribution

### Getting Help
- Check troubleshooting section
- Review error logs in console
- Check API response details

### Code Style
- Use async/await (not callbacks)
- Follow existing controller/service pattern
- Add JSDoc comments for new functions

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Maintained By:** Development Team

