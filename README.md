# PDF to Voice API

A comprehensive REST API for document processing, text extraction, summarization, and text-to-speech conversion. Upload PDF documents, extract text, generate summaries, and convert text to audio in multiple languages.

## 🚀 Features

- **PDF Processing**: Upload and extract text from PDF documents
- **Document Management**: List, retrieve, and manage uploaded documents
- **AI Summarization**: Generate intelligent summaries in multiple languages (default: French)
- **Text-to-Speech (TTS)**: Convert text to high-quality audio using Edge TTS or Google Gemini
- **Question Answering**: Ask general knowledge questions with AI-powered responses
- **Audio Caching**: Efficient caching system for summaries and audio files
- **Free AI Alternatives**: Support for Groq and Hugging Face APIs as free alternatives
- **Multi-language Support**: French, English, Spanish, German, Italian, Portuguese

## 📋 Prerequisites

Before installing, ensure you have:

- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher) or **yarn**
- **Google Gemini API Key** (required for core functionality)
- **Optional**: Groq API Key (for free AI alternatives)
- **Optional**: Hugging Face API Key (for free AI alternatives)

## 🔧 Installation

### 1. Clone or Download the Project

```bash
cd document-reader/api
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `express` - Web framework
- `@google/genai` - Google Gemini AI SDK
- `pdf-parse` - PDF text extraction
- `express-fileupload` - File upload handling
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `edge-tts` - Microsoft Edge TTS (free TTS service)

### 3. Install Optional Dependencies

For free AI alternatives (recommended for QA endpoint):

```bash
npm install groq-sdk
```

For Edge TTS (free Text-to-Speech):

```bash
npm install edge-tts
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory (`api/.env`):

```env
# Server Configuration
PORT=3000

# Google Gemini API (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# Free AI Alternatives (Optional)
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Optional Configuration
MAX_FILE_SIZE=10485760  # 10MB in bytes (default: 10MB)
TTS_TEXT_LIMIT=4000     # Maximum characters for TTS (default: 4000)
USE_FREE_AI=true        # Use free AI for QA endpoint (default: true)
```

#### Getting API Keys

**Google Gemini API Key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to `.env`

**Groq API Key (Optional):**
1. Go to [Groq Console](https://console.groq.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to `.env`

**Hugging Face API Key (Optional):**
1. Go to [Hugging Face](https://huggingface.co/)
2. Sign up or log in
3. Go to Settings → Access Tokens
4. Create a new token with "Read" permission
5. Copy the token and add it to `.env`

### 5. Create Required Directories

The application will automatically create the following directories on first run:
- `uploads/` - For uploaded PDF files
- `audios/` - For generated audio files

You can also create them manually:

```bash
mkdir uploads audios
```

### 6. Start the Server

```bash
node server.js
```

Or if you have a start script:

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

You should see:
```
Server is running at http://localhost:3000
API Key: xxxx... (Set via .env file or GEMINI_API_KEY)
Uploads Directory: /path/to/uploads
Audio Directory: /path/to/audios
-----------------------------------------
NOTE: Open index.html in your browser.
```

## 📁 Project Structure

```
api/
├── config/
│   └── config.js              # Application configuration
├── controllers/
│   ├── audioController.js     # Audio file serving
│   ├── documentController.js  # Document operations
│   ├── qaController.js        # Question answering
│   └── ttsController.js       # Text-to-speech
├── middleware/
│   ├── errorHandler.js        # Global error handling
│   └── validation.js          # Input validation
├── routes/
│   ├── audioRoutes.js         # Audio routes
│   ├── documentRoutes.js      # Document routes
│   ├── qaRoutes.js            # QA routes
│   └── ttsRoutes.js           # TTS routes
├── services/
│   ├── edgeTTSService.js      # Edge TTS service
│   ├── freeAIService.js       # Free AI alternatives
│   └── geminiService.js       # Google Gemini service
├── utils/
│   ├── audioUtils.js          # Audio conversion utilities
│   ├── constants.js           # Application constants
│   ├── fileUtils.js           # File system utilities
│   └── pdfUtils.js            # PDF utilities (unused)
├── public/
│   └── index.html             # Simple frontend interface
├── uploads/                   # Uploaded PDF files (auto-created)
├── audios/                     # Generated audio files (auto-created)
├── server.js                   # Main server file
├── package.json               # Dependencies
└── .env                       # Environment variables (create this)
```

## 🎯 Usage Examples

### Using the API

See `API_COLLECTION.md` for complete API documentation, or import `API_COLLECTION.postman.json` into Postman.

### Quick Start Examples

**1. Upload a PDF:**
```bash
curl -X POST http://localhost:3000/api/documents \
  -F "pdfFile=@document.pdf"
```

**2. Get Summary (French by default):**
```bash
curl http://localhost:3000/api/documents/{docId}/summary
```

**3. Generate TTS Audio:**
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"docId": "your-doc-id"}'
```

**4. Ask a Question:**
```bash
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question": "Qu\'est-ce que l\'intelligence artificielle?"}'
```

### Using the Frontend

1. Open `public/index.html` in your browser
2. Or access it via: `http://localhost:3000/index.html`

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/documents` | List all documents |
| `POST` | `/api/documents` | Upload PDF document |
| `GET` | `/api/documents/:docId/file` | Get PDF file |
| `GET` | `/api/documents/:docId/summary` | Get summary + audio |
| `GET` | `/api/documents/:docId/summary/audio` | Get summary audio only |
| `POST` | `/api/tts` | Generate TTS audio |
| `POST` | `/api/qa` | Answer questions |
| `GET` | `/api/audio/:audioId` | Get audio file |

For detailed API documentation, see [API_COLLECTION.md](./API_COLLECTION.md).

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `GEMINI_API_KEY` | **Yes** | - | Google Gemini API key |
| `GROQ_API_KEY` | No | - | Groq API key (for free AI) |
| `HUGGINGFACE_API_KEY` | No | - | Hugging Face API key (for free AI) |
| `MAX_FILE_SIZE` | No | `10485760` | Maximum file size in bytes (10MB) |
| `TTS_TEXT_LIMIT` | No | `4000` | Maximum characters for TTS |
| `USE_FREE_AI` | No | `true` | Use free AI for QA endpoint |

### File Limits

- **PDF Upload**: Maximum 10MB
- **Question Length**: 3-1000 characters
- **TTS Text**: 4000 characters (auto-truncated)

### Supported Languages

- `en` - English
- `fr` - French (default for summaries)
- `es` - Spanish
- `de` - German
- `it` - Italian
- `pt` - Portuguese

## 🐛 Troubleshooting

### Server Won't Start

**Error: "GEMINI_API_KEY environment variable is not set"**
- Ensure `.env` file exists in the `api/` directory
- Check that `GEMINI_API_KEY` is set correctly
- Restart the server after adding/changing `.env`

**Error: "Port already in use"**
- Change `PORT` in `.env` to a different port
- Or stop the process using port 3000

### File Upload Issues

**Error: "No PDF file uploaded"**
- Ensure you're using `multipart/form-data` content type
- Field name must be `pdfFile`
- Check file size (max 10MB)

**Error: "Only PDF files are allowed"**
- Ensure file has `.pdf` extension
- Check file MIME type is `application/pdf`

### AI Service Issues

**Error: "All AI services failed"**
- Check your API keys are valid
- Verify internet connection
- Check API rate limits
- For free AI, ensure Groq/Hugging Face keys are set (optional)

**Edge TTS Not Working**
- Install edge-tts: `npm install edge-tts`
- Check internet connection (Edge TTS requires online access)

### Audio Issues

**Audio file not found**
- Ensure audio was generated successfully
- Check `audios/` directory exists
- Verify audio ID format is correct

## 📚 Additional Documentation

- **[API_COLLECTION.md](./API_COLLECTION.md)** - Complete API documentation
- **[TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)** - Technical architecture details
- **[FREE_AI_SETUP.md](./FREE_AI_SETUP.md)** - Free AI alternatives setup guide
- **[PERFORMANCE_IMPROVEMENTS_REPORT.md](./PERFORMANCE_IMPROVEMENTS_REPORT.md)** - Performance analysis

## 🔒 Security Notes

- Never commit `.env` file to version control
- Keep API keys secure and private
- Validate file uploads (already implemented)
- Path traversal protection (already implemented)
- File size limits enforced (already implemented)

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the technical documentation
3. Check API collection for endpoint details

---

**Version**: 1.0.0  
**Last Updated**: 2025
