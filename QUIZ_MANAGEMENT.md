# Quiz Management Guide

This guide explains how to add, update, and manage quiz questions for chapters.

## API Endpoints

All quiz management endpoints require **admin authentication**. You must be logged in as an admin user.

### Base URL
```
/api/courses/:courseId/chapters/:chapterId/quiz/admin
```

## 1. Get All Quiz Questions (Admin)

Get all questions for a chapter, including correct answers (for admin management).

**Endpoint:** `GET /api/courses/:courseId/chapters/:chapterId/quiz/admin`

**Example:**
```bash
curl -X GET "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "chapterId": "chapter-uuid",
  "questions": [
    {
      "id": "question-uuid",
      "chapterId": "chapter-uuid",
      "questionText": "What is React?",
      "options": ["A library", "A framework", "A language", "A database"],
      "correctAnswerIndex": 0,
      "explanation": "React is a JavaScript library for building user interfaces.",
      "orderIndex": 0,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "totalQuestions": 1
}
```

## 2. Create a Quiz Question

**Endpoint:** `POST /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions`

**Request Body:**
```json
{
  "questionText": "What is React?",
  "options": [
    "A JavaScript library for building user interfaces",
    "A CSS framework",
    "A database management system",
    "A programming language"
  ],
  "correctAnswerIndex": 0,
  "explanation": "React is a JavaScript library developed by Facebook for building user interfaces, particularly web applications.",
  "orderIndex": 0
}
```

**Example using cURL:**
```bash
curl -X POST "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin/questions" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "What is React?",
    "options": [
      "A JavaScript library for building user interfaces",
      "A CSS framework",
      "A database management system",
      "A programming language"
    ],
    "correctAnswerIndex": 0,
    "explanation": "React is a JavaScript library developed by Facebook.",
    "orderIndex": 0
  }'
```

**Response:**
```json
{
  "message": "Quiz question created successfully",
  "question": {
    "id": "question-uuid",
    "chapterId": "chapter-uuid",
    "questionText": "What is React?",
    "options": ["A JavaScript library...", "A CSS framework", ...],
    "correctAnswerIndex": 0,
    "explanation": "React is a JavaScript library...",
    "orderIndex": 0
  }
}
```

## 3. Update a Quiz Question

**Endpoint:** `PUT /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions/:questionId`

**Request Body:** (all fields are optional)
```json
{
  "questionText": "Updated question text",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctAnswerIndex": 2,
  "explanation": "Updated explanation",
  "orderIndex": 1
}
```

**Example:**
```bash
curl -X PUT "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin/questions/QUESTION_ID" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "What is the main purpose of React?",
    "correctAnswerIndex": 0
  }'
```

## 4. Delete a Quiz Question

**Endpoint:** `DELETE /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions/:questionId`

**Example:**
```bash
curl -X DELETE "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin/questions/QUESTION_ID" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Response:**
```json
{
  "message": "Quiz question deleted successfully"
}
```

## Field Descriptions

- **questionText** (required): The question text
- **options** (required): Array of answer options (minimum 2 options)
- **correctAnswerIndex** (required): Index of the correct answer (0-based)
- **explanation** (optional): Explanation shown after quiz submission
- **orderIndex** (optional): Order of the question in the quiz (default: 0)

## Example: Creating Multiple Questions

Here's a complete example of creating a quiz with 3 questions:

```bash
# Question 1
curl -X POST "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin/questions" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "What is React?",
    "options": ["A library", "A framework", "A language"],
    "correctAnswerIndex": 0,
    "explanation": "React is a JavaScript library.",
    "orderIndex": 0
  }'

# Question 2
curl -X POST "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin/questions" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "What is JSX?",
    "options": ["JavaScript XML", "Java Syntax Extension", "JSON XML"],
    "correctAnswerIndex": 0,
    "explanation": "JSX is a syntax extension for JavaScript.",
    "orderIndex": 1
  }'

# Question 3
curl -X POST "http://localhost:3002/api/courses/COURSE_ID/chapters/CHAPTER_ID/quiz/admin/questions" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "What is a component in React?",
    "options": ["A function or class", "A variable", "A database table"],
    "correctAnswerIndex": 0,
    "explanation": "Components are reusable pieces of UI.",
    "orderIndex": 2
  }'
```

## Using JavaScript/Fetch

```javascript
const API_URL = 'http://localhost:3002';
const courseId = 'your-course-id';
const chapterId = 'your-chapter-id';

// Create a quiz question
async function createQuizQuestion() {
  const response = await fetch(
    `${API_URL}/api/courses/${courseId}/chapters/${chapterId}/quiz/admin/questions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: sends session cookie
      body: JSON.stringify({
        questionText: "What is React?",
        options: [
          "A JavaScript library for building user interfaces",
          "A CSS framework",
          "A database management system",
          "A programming language"
        ],
        correctAnswerIndex: 0,
        explanation: "React is a JavaScript library developed by Facebook.",
        orderIndex: 0
      })
    }
  );

  const data = await response.json();
  console.log('Question created:', data);
}

// Get all questions
async function getQuizQuestions() {
  const response = await fetch(
    `${API_URL}/api/courses/${courseId}/chapters/${chapterId}/quiz/admin`,
    {
      credentials: 'include'
    }
  );

  const data = await response.json();
  console.log('Questions:', data);
}
```

## Direct Database Insert (Alternative)

If you prefer to insert questions directly into the database:

```sql
INSERT INTO quiz_questions (
  id, 
  chapter_id, 
  question_text, 
  options, 
  correct_answer_index, 
  explanation, 
  order_index
) VALUES (
  UUID(),  -- or use a specific UUID
  'your-chapter-id',
  'What is React?',
  '["A library", "A framework", "A language", "A database"]',
  0,
  'React is a JavaScript library for building user interfaces.',
  0
);
```

## Notes

1. **Authentication**: All admin endpoints require you to be logged in as an admin user
2. **Session Cookie**: When using cURL, you need to include your session cookie from the browser
3. **Validation**: 
   - `questionText` is required
   - `options` must be an array with at least 2 items
   - `correctAnswerIndex` must be a valid index (0 to options.length - 1)
4. **Order**: Questions are displayed in order of `orderIndex`, then by creation date

## Testing

To test if your quiz was created successfully:

1. Use the admin endpoint to fetch all questions
2. Or use the public endpoint (without answers) to see what students see:
   ```
   GET /api/courses/:courseId/chapters/:chapterId/quiz
   ```
