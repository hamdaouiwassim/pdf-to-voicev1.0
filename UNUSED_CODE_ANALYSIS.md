# Unused Files & Code Analysis

**Date:** 2025-01-XX  
**Purpose:** Identify unused files, dependencies, and code snippets for cleanup

---

## 🗑️ Unused Files

### 1. `utils/pdfUtils.js` ❌ **UNUSED**

**Status:** File exists but not imported anywhere  
**Size:** ~36 lines  
**Functions:**
- `createPDF(filePath, title, text)` - Generates PDF from text

**Reason for Non-Usage:**
- Originally used to generate PDFs from text input
- Current implementation saves uploaded PDFs directly instead of generating new ones
- The `createDocument()` endpoint now extracts text from uploaded PDFs, not from text input

**Evidence:**
```bash
# Search for imports
grep -r "pdfUtils" .
# Result: No matches found
```

**Recommendation:**
- **Option A (Remove):** Delete file if "generate PDF from text" feature is not planned
- **Option B (Keep):** Keep for future feature to generate PDFs programmatically
- **Action:** Safe to remove if not needed

**Code Location:**
```javascript
// utils/pdfUtils.js - Entire file is unused
```

---

### 2. `middleware/validation.js` ❌ **UNUSED**

**Status:** File exists, functions defined, but never applied to routes  
**Size:** ~46 lines  
**Functions:**
- `validateFileUpload(req, res, next)` - Validates file uploads
- `validateDocumentRequest(req, res, next)` - Validates document creation
- `validateQuestionRequest(req, res, next)` - Validates question format

**Reason for Non-Usage:**
- Validation is currently done inline in controllers
- Middleware was created but never integrated into routes
- Routes don't use `router.use()` or `router.post('/', validation.fn, controller.fn)`

**Evidence:**
```bash
# Search for usage
grep -r "validateFileUpload\|validateDocumentRequest\|validateQuestionRequest" .
# Result: Only found in middleware/validation.js itself and documentation files
```

**Current Implementation:**
- Controllers validate requests directly:
  ```javascript
  // controllers/documentController.js
  if (!req.files || !req.files.pdfFile) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  ```

**Recommendation:**
- **Option A (Remove):** Delete if inline validation is preferred
- **Option B (Integrate):** Apply to routes for cleaner code:
  ```javascript
  // routes/documentRoutes.js
  const validation = require('../middleware/validation');
  router.post('/', validation.validateFileUpload, documentController.createDocument);
  ```
- **Action:** Recommended to integrate for better code organization

---

## 📦 Unused Dependencies

### Development Dependencies (Not Used in Project)

#### 1. `tailwindcss` (^4.1.16) ❌

**Status:** Installed but not used  
**Reason:**
- No Tailwind CSS configuration file
- No CSS files using Tailwind classes
- No build process for Tailwind
- Frontend is basic HTML without CSS framework

**Evidence:**
```bash
# Check for Tailwind config
ls tailwind.config.* postcss.config.*
# Result: No files found
```

**Action:** Can be safely removed
```bash
npm uninstall tailwindcss
```

---

#### 2. `autoprefixer` (^10.4.21) ❌

**Status:** Installed but not used  
**Reason:**
- No PostCSS configuration
- No CSS processing pipeline
- No build scripts using autoprefixer

**Action:** Can be safely removed
```bash
npm uninstall autoprefixer
```

---

#### 3. `postcss` (^8.5.6) ❌

**Status:** Installed but not used  
**Reason:**
- No PostCSS configuration file
- No CSS processing in build pipeline
- No scripts using PostCSS

**Action:** Can be safely removed
```bash
npm uninstall postcss
```

**Note:** These three packages are typically used together. If removing Tailwind, all three can be removed.

---

### Production Dependencies (Potentially Unused)

#### 4. `pdfkit` (^0.17.2) ⚠️ **PARTIALLY UNUSED**

**Status:** Used in `pdfUtils.js` which is unused  
**Reason:**
- Only imported in `utils/pdfUtils.js`
- `pdfUtils.js` is not imported anywhere
- Therefore, `pdfkit` is effectively unused

**Evidence:**
```javascript
// Only used in unused file
// utils/pdfUtils.js
const PDFDocument = require('pdfkit');  // Only here
```

**Action:**
- If removing `pdfUtils.js`, also remove `pdfkit`:
  ```bash
  npm uninstall pdfkit
  ```

---

## 🔍 Unused Code Snippets

### 1. In `server.js`

**Line 28-29:** Outdated comment
```javascript
// --- API Routes ---
// Maintain backward compatibility for /api/extract-text
app.use('/api/documents', documentRoutes);
```

**Issue:** The comment mentions `/api/extract-text` but:
- The route is handled by `documentRoutes.post('/')` which maps to `createDocument`
- The endpoint is actually `/api/documents` (POST), not `/api/extract-text`
- The frontend uses `/api/documents` according to `index.html`

**Action:** Update comment or remove if not needed

---

### 2. In `package.json`

**Line 4:** `"main": "index.js"`

**Issue:** 
- File `index.js` doesn't exist
- Entry point is actually `server.js`

**Action:** Change to:
```json
"main": "server.js"
```
Or remove if not needed (Express apps don't require it)

---

### 3. In `routes/documentRoutes.js`

**Line 4:** Comment formatting
```javascript
// GET /api/documents - Get list of all documents
router.get('/', documentController.getAllDocuments);
```

**Note:** Minor formatting issue, but functional. Not a problem, just inconsistent commenting style.

---

## 📊 Summary Statistics

### Files Analysis
- **Total JavaScript Files:** 19
- **Active Files:** 17
- **Unused Files:** 2
  - `utils/pdfUtils.js`
  - `middleware/validation.js` (functions defined but not applied)

### Dependencies Analysis
- **Total Dependencies:** 7 production, 3 dev
- **Unused Production:** 1 (pdfkit, if pdfUtils removed)
- **Unused Dev Dependencies:** 3 (tailwindcss, autoprefixer, postcss)

### Code Cleanup Potential
- **Lines of Unused Code:** ~82 lines (pdfUtils: 36, validation: 46)
- **Dependencies to Remove:** 3-4 packages
- **Package Size Reduction:** ~50-100MB (estimated)

---

## 🧹 Cleanup Recommendations

### Immediate Actions (Safe to Remove)

1. **Remove unused devDependencies:**
   ```bash
   npm uninstall tailwindcss autoprefixer postcss
   ```

2. **Remove unused file:**
   ```bash
   # If not planning to use PDF generation
   rm utils/pdfUtils.js
   npm uninstall pdfkit
   ```

3. **Fix package.json:**
   ```json
   {
     "main": "server.js"  // or remove this line
   }
   ```

### Optional Actions (Requires Decision)

1. **Integrate validation middleware:**
   - Apply `validation.js` to routes
   - Or remove if inline validation is preferred

2. **Update comments:**
   - Fix outdated comments in `server.js`
   - Ensure comments match actual implementation

---

## ✅ Verification Checklist

Before removing files, verify:

- [ ] No references in codebase (use `grep -r "filename" .`)
- [ ] No references in documentation
- [ ] Not used in tests (if any)
- [ ] Not planned for future features
- [ ] Backup or git history available

---

## 📝 Removal Script

If you want to clean up, here's a safe removal script:

```bash
# Remove unused dev dependencies
npm uninstall tailwindcss autoprefixer postcss

# Remove unused file (if confirmed)
# rm utils/pdfUtils.js

# Remove pdfkit if pdfUtils is removed
# npm uninstall pdfkit

# Verify no broken imports
npm run test  # If tests exist
```

---

## 🔄 Migration Path (If Using Validation)

If you want to use the validation middleware:

### Step 1: Update Routes
```javascript
// routes/documentRoutes.js
const validation = require('../middleware/validation');

router.post('/', 
  validation.validateFileUpload, 
  documentController.createDocument
);
```

### Step 2: Update Controllers
Remove inline validation (already handled by middleware)

### Step 3: Test
Ensure all endpoints work correctly with middleware

---

**Last Updated:** 2025-01-XX  
**Next Review:** After major refactoring

