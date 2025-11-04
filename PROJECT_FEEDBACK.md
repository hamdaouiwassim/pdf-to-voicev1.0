# Document Reader API - Project Analysis & Feedback

## 📋 Project Overview
A Node.js/Express API that processes PDF documents, extracts text, generates text-to-speech audio, and provides Q&A functionality using Google's Gemini AI.

---

## ✅ **Strengths**

### 1. **Core Functionality**
- ✅ Well-structured API endpoints for document management
- ✅ Effective TTS caching mechanism to reduce API calls
- ✅ Proper file system organization (uploads/audios directories)
- ✅ Integration with Gemini AI for advanced features

### 2. **Code Organization**
- ✅ Clear separation of concerns (routes, utilities, configuration)
- ✅ Good use of environment variables for API keys
- ✅ Helpful console logging for debugging

---

## ⚠️ **Critical Issues**

### 1. **Security Vulnerabilities**

#### **Hardcoded Test Data in Production Code**
```javascript
// Line 149: Hardcoded filename
const jsonFilename = `test-1.json`;  // ❌ CRITICAL
```
**Impact**: All uploaded PDFs overwrite the same file (`test-1.json`), causing data loss.
**Fix**: Use unique IDs like other endpoints:
```javascript
const docId = crypto.randomUUID();
const jsonFilename = `${docId}.json`;
```

#### **Missing File Upload Validation**
- No file type validation (accepts any file, not just PDFs)
- No file size limits
- No virus/malware scanning
- No sanitization of filenames

#### **Exposed API Endpoints**
- No authentication/authorization
- No rate limiting
- CORS enabled for all origins (potential security risk)

#### **Sensitive Data in Logs**
```javascript
console.log(`[TTS] Cache miss. Generating new voice for doc ID: ${docId}` , text);
// ❌ Logs full document text - potential privacy leak
```

### 2. **Code Quality Issues**

#### **Inconsistent Error Handling**
- Some endpoints return plain text errors, others return JSON
- Inconsistent error message formats
- Missing error handling for file system operations

#### **Code Duplication**
- Duplicate CORS setup (lines 23 and 128)
- Similar JSON sidecar creation logic repeated

#### **Hardcoded Values**
```javascript
const contentForTTS = text.substring(0, 4000);  // Magic number
const PORT = 3000;  // Should use environment variable
```

#### **Missing Input Validation**
- No validation for request body fields
- No sanitization of user inputs
- No file extension checking

### 3. **Architecture Issues**

#### **Missing Route for Audio Files**
- QA endpoint saves audio files but no endpoint to serve them
- Referenced `/api/audio/${qaAudioId}` endpoint doesn't exist (line 467)

#### **Synchronous File Operations**
```javascript
fs.writeFileSync(jsonFilePath, JSON.stringify(sidecarData), 'utf8');
// ❌ Blocks event loop - should use async/await with fs.promises
```

#### **PDF Generation Issue**
```javascript
doc.pipe(fs.createWriteStream(pdfFilePath));
doc.end();  // ❌ No await - file may not be saved before response
```

#### **No Database**
- File-based storage doesn't scale
- No querying capabilities
- Risk of data loss

---

## 🔧 **Recommendations**

### **High Priority**

1. **Fix Hardcoded Test Data**
   ```javascript
   // Replace line 149-160 with:
   const docId = crypto.randomUUID();
   const jsonFilename = `${docId}.json`;
   const sidecarData = { 
       id: docId, 
       title: req.body.title || "Untitled", 
       text: result.text, 
       filename: `${docId}.pdf`, 
       length: result.text.length, 
       timestamp: new Date().toISOString() 
   };
   ```

2. **Add File Upload Validation**
   ```javascript
   const allowedMimeTypes = ['application/pdf'];
   const maxFileSize = 10 * 1024 * 1024; // 10MB
   
   if (!allowedMimeTypes.includes(req.files.pdfFile.mimetype)) {
       return res.status(400).json({ error: 'Only PDF files are allowed' });
   }
   if (req.files.pdfFile.size > maxFileSize) {
       return res.status(400).json({ error: 'File size exceeds 10MB' });
   }
   ```

3. **Add Missing Audio Endpoint**
   ```javascript
   app.get('/api/audio/:audioId', (req, res) => {
       const { audioId } = req.params;
       const audioFilePath = path.join(AUDIOS_DIR, `${audioId}.wav`);
       
       if (!fs.existsSync(audioFilePath)) {
           return res.status(404).json({ error: 'Audio file not found' });
       }
       
       res.setHeader('Content-Type', 'audio/wav');
       res.sendFile(audioFilePath);
   });
   ```

4. **Use Async File Operations**
   ```javascript
   const fsPromises = require('fs').promises;
   
   // Replace fs.writeFileSync with:
   await fsPromises.writeFile(jsonFilePath, JSON.stringify(sidecarData), 'utf8');
   ```

5. **Fix PDF Generation**
   ```javascript
   await new Promise((resolve, reject) => {
       const doc = new PDFDocument();
       doc.pipe(fs.createWriteStream(pdfFilePath));
       doc.fontSize(12).text(title, { align: 'center' }).moveDown(1);
       doc.fontSize(10).text(text);
       doc.on('end', resolve);
       doc.on('error', reject);
       doc.end();
   });
   ```

### **Medium Priority**

6. **Add Environment Configuration**
   ```javascript
   const PORT = process.env.PORT || 3000;
   const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || 10485760; // 10MB
   const TTS_TEXT_LIMIT = process.env.TTS_TEXT_LIMIT || 4000;
   ```

7. **Standardize Error Responses**
   ```javascript
   // Create error handler middleware
   const errorHandler = (err, req, res, next) => {
       console.error(err);
       res.status(err.status || 500).json({
           error: err.message || 'Internal server error',
           ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
       });
   };
   app.use(errorHandler);
   ```

8. **Add Request Validation Middleware**
   ```javascript
   const validateDocumentRequest = (req, res, next) => {
       const { title, text } = req.body;
       if (!title || typeof title !== 'string' || title.trim().length === 0) {
           return res.status(400).json({ error: 'Valid title is required' });
       }
       if (!text || typeof text !== 'string' || text.trim().length === 0) {
           return res.status(400).json({ error: 'Valid text is required' });
       }
       next();
   };
   ```

9. **Remove Sensitive Data from Logs**
   ```javascript
   // Instead of logging full text:
   console.log(`[TTS] Cache miss. Generating new voice for doc ID: ${docId}, length: ${text.length} chars`);
   ```

10. **Add Health Check Endpoint**
    ```javascript
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            version: require('./package.json').version
        });
    });
    ```

### **Low Priority (But Important)**

11. **Add API Documentation**
    - Consider using Swagger/OpenAPI
    - Add JSDoc comments to functions

12. **Add Testing**
    - Unit tests for utility functions
    - Integration tests for API endpoints
    - Add test script to package.json

13. **Add Logging Library**
    - Replace console.log with proper logging (Winston, Pino)
    - Add log levels and file rotation

14. **Consider Database Migration**
    - SQLite for simple start
    - PostgreSQL for production
    - Add document metadata queries

15. **Add Rate Limiting**
    ```javascript
    const rateLimit = require('express-rate-limit');
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    });
    app.use('/api/', limiter);
    ```

16. **Add Authentication**
    - JWT tokens for API access
    - User-based document ownership

17. **Improve Frontend**
    - The current HTML is very basic
    - Add error handling in frontend
    - Add loading states
    - Better UI/UX

---

## 📊 **Code Metrics**

- **Lines of Code**: ~520
- **API Endpoints**: 5 (1 GET, 4 POST)
- **Dependencies**: 9 production, 3 dev
- **Test Coverage**: 0% (no tests found)

---

## 🎯 **Priority Action Items**

1. **🔴 CRITICAL**: Fix hardcoded test filename in `/api/extract-text`
2. **🔴 CRITICAL**: Add missing `/api/audio/:audioId` endpoint
3. **🟡 HIGH**: Add file upload validation
4. **🟡 HIGH**: Convert synchronous file operations to async
5. **🟡 HIGH**: Fix PDF generation to wait for completion
6. **🟢 MEDIUM**: Standardize error responses
7. **🟢 MEDIUM**: Add environment-based configuration
8. **🟢 MEDIUM**: Remove sensitive data from logs

---

## 📝 **Additional Notes**

### **Package.json Improvements**
- Add start script: `"start": "node server.js"`
- Add dev script: `"dev": "nodemon server.js"`
- Remove unused dev dependencies (Tailwind, PostCSS, Autoprefixer) if not used
- Add description and author information

### **Missing Files**
- `.gitignore` (should exclude node_modules, .env, uploads/, audios/)
- `.env.example` (template for environment variables)
- `README.md` (project documentation)

### **Code Style**
- Consider using ESLint for consistent code style
- Consider using Prettier for code formatting
- Add consistent JSDoc comments

---

## 🚀 **Overall Assessment**

**Current State**: Functional prototype with good core features but several production-readiness issues.

**Grade**: **C+** (Good foundation, needs refinement)

**Recommendation**: Address critical issues before deploying to production. The codebase shows good understanding of the requirements but needs security hardening, error handling improvements, and architectural refinements.

---

## 📚 **Resources for Improvement**

- Express.js Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
- Node.js File System Best Practices: https://nodejs.org/api/fs.html#fs_promises_api
- API Design Best Practices: https://restfulapi.net/

