const crypto = require('crypto');
const dbUtils = require('../utils/dbUtils');
const config = require('../config/config');
const constants = require('../utils/constants');
const geminiService = require('../services/geminiService');
const audioUtils = require('../utils/audioUtils');
const fileUtils = require('../utils/fileUtils');
const lipSyncService = require('../services/lipSyncService');

/**
 * Get quiz questions for a chapter
 * GET /api/courses/:courseId/chapters/:chapterId/quiz
 */
async function getQuizQuestions(req, res) {
    try {
        const { courseId, chapterId } = req.params;

        // Verify chapter exists and belongs to course
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Get quiz questions for this chapter
        const questions = await dbUtils.getQuizQuestionsByChapterId(chapterId);

        // Return questions without correct answers for security
        const questionsForUser = questions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            options: q.options,
            questionType: q.questionType || 'single', // Include question type
            orderIndex: q.orderIndex
        }));

        res.json({
            chapterId,
            questions: questionsForUser,
            totalQuestions: questions.length
        });
    } catch (error) {
        console.error('[Quiz] Error fetching quiz questions:', error);
        res.status(500).json({ error: 'Failed to fetch quiz questions' });
    }
}

/**
 * Submit quiz answers and get results
 * POST /api/courses/:courseId/chapters/:chapterId/quiz/submit
 */
async function submitQuiz(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const { answers } = req.body; // Array of { questionId, selectedIndex }

        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.session.userId;

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Get all questions with correct answers
        const allQuestions = await dbUtils.getQuizQuestionsByChapterId(chapterId);

        if (allQuestions.length === 0) {
            return res.status(404).json({ error: 'No quiz questions found for this chapter' });
        }

        // Validate answers format
        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: 'Answers must be an array' });
        }

        // Calculate score
        let score = 0;
        const detailedAnswers = [];

        for (const question of allQuestions) {
            const userAnswer = answers.find(a => a.questionId === question.id);
            const isMultiple = question.questionType === 'multiple';
            
            let isCorrect = false;
            let selectedIndex = null;
            let selectedIndices = [];

            if (isMultiple) {
                // Multiple-choice: user can select multiple answers
                selectedIndices = userAnswer && Array.isArray(userAnswer.selectedIndices) 
                    ? userAnswer.selectedIndices 
                    : (userAnswer && userAnswer.selectedIndex !== undefined ? [userAnswer.selectedIndex] : []);
                
                // Sort arrays for comparison
                const correctIndices = (question.correctAnswerIndices || []).sort((a, b) => a - b);
                const userIndices = selectedIndices.sort((a, b) => a - b);
                
                // Check if arrays match exactly
                isCorrect = correctIndices.length === userIndices.length && 
                    correctIndices.every((val, idx) => val === userIndices[idx]);
            } else {
                // Single-choice: user selects one answer
                selectedIndex = userAnswer ? userAnswer.selectedIndex : null;
                isCorrect = selectedIndex === question.correctAnswerIndex;
            }

            if (isCorrect) {
                score++;
            }

            detailedAnswers.push({
                questionId: question.id,
                questionText: question.questionText,
                questionType: question.questionType || 'single',
                options: question.options,
                correctAnswerIndex: isMultiple ? null : question.correctAnswerIndex,
                correctAnswerIndices: isMultiple ? (question.correctAnswerIndices || []) : null,
                selectedIndex: isMultiple ? null : selectedIndex,
                selectedIndices: isMultiple ? selectedIndices : null,
                isCorrect: isCorrect,
                explanation: question.explanation
            });
        }

        const totalQuestions = allQuestions.length;
        const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(2) : 0;

        // Save quiz attempt
        const attemptId = crypto.randomUUID();
        await dbUtils.createQuizAttempt({
            id: attemptId,
            userId: userId,
            chapterId: chapterId,
            score: score,
            totalQuestions: totalQuestions,
            percentage: parseFloat(percentage),
            answers: detailedAnswers
        });

        // Get best attempt for comparison
        const bestAttempt = await dbUtils.getBestQuizAttempt(userId, chapterId);

        res.json({
            attemptId,
            score,
            totalQuestions,
            percentage: parseFloat(percentage),
            answers: detailedAnswers,
            bestScore: bestAttempt ? bestAttempt.percentage : parseFloat(percentage),
            isNewBest: !bestAttempt || parseFloat(percentage) > bestAttempt.percentage
        });
    } catch (error) {
        console.error('[Quiz] Error submitting quiz:', error);
        res.status(500).json({ error: 'Failed to submit quiz' });
    }
}

/**
 * Get quiz attempts for a user and chapter
 * GET /api/courses/:courseId/chapters/:chapterId/quiz/attempts
 */
async function getQuizAttempts(req, res) {
    try {
        const { courseId, chapterId } = req.params;

        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.session.userId;

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Get all attempts for this user and chapter
        const attempts = await dbUtils.getQuizAttemptsByUserAndChapter(userId, chapterId);

        // Get best attempt
        const bestAttempt = await dbUtils.getBestQuizAttempt(userId, chapterId);

        res.json({
            attempts: attempts.map(a => ({
                id: a.id,
                score: a.score,
                totalQuestions: a.totalQuestions,
                percentage: a.percentage,
                completedAt: a.completedAt
            })),
            bestAttempt: bestAttempt ? {
                id: bestAttempt.id,
                score: bestAttempt.score,
                totalQuestions: bestAttempt.totalQuestions,
                percentage: bestAttempt.percentage,
                completedAt: bestAttempt.completedAt
            } : null,
            totalAttempts: attempts.length
        });
    } catch (error) {
        console.error('[Quiz] Error fetching quiz attempts:', error);
        res.status(500).json({ error: 'Failed to fetch quiz attempts' });
    }
}

/**
 * Get a specific quiz attempt with detailed answers
 * GET /api/courses/:courseId/chapters/:chapterId/quiz/attempts/:attemptId
 */
async function getQuizAttempt(req, res) {
    try {
        const { courseId, chapterId, attemptId } = req.params;

        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.session.userId;

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Get attempt
        const attempt = await dbUtils.getQuizAttemptById(attemptId);

        if (!attempt) {
            return res.status(404).json({ error: 'Quiz attempt not found' });
        }

        // Verify attempt belongs to user
        if (attempt.userId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(attempt);
    } catch (error) {
        console.error('[Quiz] Error fetching quiz attempt:', error);
        res.status(500).json({ error: 'Failed to fetch quiz attempt' });
    }
}

/**
 * ADMIN ENDPOINTS - Quiz Management
 */

/**
 * Get all quiz questions for a chapter (admin - includes correct answers)
 * GET /api/courses/:courseId/chapters/:chapterId/quiz/admin
 */
async function getQuizQuestionsAdmin(req, res) {
    try {
        const { courseId, chapterId } = req.params;

        // Check if user is admin
        if (!req.session || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Get all questions with correct answers
        const questions = await dbUtils.getQuizQuestionsByChapterId(chapterId);

        res.json({
            chapterId,
            questions: questions,
            totalQuestions: questions.length
        });
    } catch (error) {
        console.error('[Quiz Admin] Error fetching quiz questions:', error);
        res.status(500).json({ error: 'Failed to fetch quiz questions' });
    }
}

/**
 * Create a quiz question (admin only)
 * POST /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions
 */
async function createQuizQuestion(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const { questionText, options, questionType = 'single', correctAnswerIndex, correctAnswerIndices, explanation, orderIndex } = req.body;

        // Debug logging
        console.log('[Quiz Admin] Creating question with data:', {
            courseId,
            chapterId,
            questionText: questionText ? questionText.substring(0, 50) + '...' : null,
            optionsCount: Array.isArray(options) ? options.length : 'not an array',
            options: options,
            correctAnswerIndex,
            explanation: explanation ? explanation.substring(0, 50) + '...' : null,
            orderIndex
        });

        // Check if user is admin
        if (!req.session || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Validate input
        if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Invalid input: questionText is required and must be a non-empty string' 
            });
        }

        if (!Array.isArray(options)) {
            console.error('[Quiz Admin] Options is not an array:', typeof options, options);
            return res.status(400).json({ 
                error: 'Invalid input: options must be an array' 
            });
        }

        // Filter out empty options
        const validOptions = options
            .map(opt => typeof opt === 'string' ? opt.trim() : String(opt).trim())
            .filter(opt => opt.length > 0);

        if (validOptions.length < 2) {
            console.error('[Quiz Admin] Not enough valid options:', validOptions);
            return res.status(400).json({ 
                error: 'Invalid input: at least 2 non-empty options are required' 
            });
        }

        // Validate question type
        const isMultiple = questionType === 'multiple';
        if (!['single', 'multiple'].includes(questionType)) {
            return res.status(400).json({ 
                error: 'Invalid questionType: must be "single" or "multiple"' 
            });
        }

        // Validate correct answers based on question type
        if (isMultiple) {
            if (!Array.isArray(correctAnswerIndices) || correctAnswerIndices.length === 0) {
                return res.status(400).json({ 
                    error: 'Multiple-choice questions require at least one correct answer index in correctAnswerIndices array' 
                });
            }
            // Validate all indices are valid
            const invalidIndices = correctAnswerIndices.filter(idx => 
                isNaN(idx) || idx < 0 || idx >= validOptions.length
            );
            if (invalidIndices.length > 0) {
                return res.status(400).json({ 
                    error: `Invalid correctAnswerIndices: indices ${invalidIndices.join(', ')} are out of range (0-${validOptions.length - 1})` 
                });
            }
        } else {
            if (correctAnswerIndex === undefined || correctAnswerIndex === null || 
                isNaN(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= validOptions.length) {
                return res.status(400).json({ 
                    error: `Invalid correctAnswerIndex: must be a valid option index (0-${validOptions.length - 1})` 
                });
            }
        }

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Create question
        const questionId = crypto.randomUUID();
        const questionData = {
            id: questionId,
            chapterId: chapterId,
            questionText: questionText.trim(),
            options: validOptions,
            questionType: isMultiple ? 'multiple' : 'single',
            correctAnswerIndex: isMultiple ? null : parseInt(correctAnswerIndex),
            correctAnswerIndices: isMultiple ? correctAnswerIndices.map(idx => parseInt(idx)).sort((a, b) => a - b) : null,
            explanation: explanation ? explanation.trim() : null,
            orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : 0
        };

        console.log('[Quiz Admin] Saving question with data:', {
            ...questionData,
            optionsCount: questionData.options.length,
            options: questionData.options
        });

        const question = await dbUtils.createQuizQuestion(questionData);

        console.log('[Quiz Admin] Question created successfully:', {
            id: question.id,
            optionsCount: question.options ? question.options.length : 0,
            options: question.options
        });

        res.status(201).json({
            message: 'Quiz question created successfully',
            question: question
        });
    } catch (error) {
        console.error('[Quiz Admin] Error creating quiz question:', error);
        console.error('[Quiz Admin] Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to create quiz question',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Update a quiz question (admin only)
 * PUT /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions/:questionId
 */
async function updateQuizQuestion(req, res) {
    try {
        const { courseId, chapterId, questionId } = req.params;
        const { questionText, options, questionType, correctAnswerIndex, correctAnswerIndices, explanation, orderIndex } = req.body;

        // Check if user is admin
        if (!req.session || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Verify question exists and belongs to chapter
        const existingQuestion = await dbUtils.getQuizQuestionById(questionId);
        if (!existingQuestion || existingQuestion.chapterId !== chapterId) {
            return res.status(404).json({ error: 'Quiz question not found' });
        }

        // Build update object
        const updates = {};
        if (questionText !== undefined) updates.questionText = questionText.trim();
        if (options !== undefined) {
            if (!Array.isArray(options) || options.length < 2) {
                return res.status(400).json({ error: 'Options must be an array with at least 2 items' });
            }
            updates.options = options.map(opt => opt.trim());
        }
        if (questionType !== undefined) {
            if (!['single', 'multiple'].includes(questionType)) {
                return res.status(400).json({ error: 'questionType must be "single" or "multiple"' });
            }
            updates.questionType = questionType;
        }
        
        const finalOptions = updates.options || existingQuestion.options;
        const isMultiple = (updates.questionType || existingQuestion.questionType) === 'multiple';
        
        if (correctAnswerIndex !== undefined && !isMultiple) {
            if (correctAnswerIndex < 0 || correctAnswerIndex >= finalOptions.length) {
                return res.status(400).json({ error: 'Invalid correctAnswerIndex' });
            }
            updates.correctAnswerIndex = parseInt(correctAnswerIndex);
        }
        if (correctAnswerIndices !== undefined && isMultiple) {
            if (!Array.isArray(correctAnswerIndices) || correctAnswerIndices.length === 0) {
                return res.status(400).json({ error: 'correctAnswerIndices must be a non-empty array' });
            }
            const invalidIndices = correctAnswerIndices.filter(idx => 
                isNaN(idx) || idx < 0 || idx >= finalOptions.length
            );
            if (invalidIndices.length > 0) {
                return res.status(400).json({ error: `Invalid indices: ${invalidIndices.join(', ')}` });
            }
            updates.correctAnswerIndices = correctAnswerIndices.map(idx => parseInt(idx)).sort((a, b) => a - b);
        }
        if (explanation !== undefined) updates.explanation = explanation ? explanation.trim() : null;
        if (orderIndex !== undefined) updates.orderIndex = parseInt(orderIndex);

        // Update question
        const updatedQuestion = await dbUtils.updateQuizQuestion(questionId, updates);

        res.json({
            message: 'Quiz question updated successfully',
            question: updatedQuestion
        });
    } catch (error) {
        console.error('[Quiz Admin] Error updating quiz question:', error);
        res.status(500).json({ error: 'Failed to update quiz question' });
    }
}

/**
 * Delete a quiz question (admin only)
 * DELETE /api/courses/:courseId/chapters/:chapterId/quiz/admin/questions/:questionId
 */
async function deleteQuizQuestion(req, res) {
    try {
        const { courseId, chapterId, questionId } = req.params;

        // Check if user is admin
        if (!req.session || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify chapter exists
        const chapter = await dbUtils.getChapterById(courseId, chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        // Verify question exists and belongs to chapter
        const existingQuestion = await dbUtils.getQuizQuestionById(questionId);
        if (!existingQuestion || existingQuestion.chapterId !== chapterId) {
            return res.status(404).json({ error: 'Quiz question not found' });
        }

        // Delete question
        const deleted = await dbUtils.deleteQuizQuestion(questionId);
        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete quiz question' });
        }

        res.json({
            message: 'Quiz question deleted successfully'
        });
    } catch (error) {
        console.error('[Quiz Admin] Error deleting quiz question:', error);
        res.status(500).json({ error: 'Failed to delete quiz question' });
    }
}

/**
 * Synthesize feedback audio for quiz results
 * Always uses Gemini TTS for high quality
 */
async function synthesizeFeedbackAudio(text) {
    if (!text || !text.trim()) {
        return null;
    }
    console.log(text);
    // Always use Gemini TTS for quiz feedback
    try {
        const { pcmBuffer } = await geminiService.generateQuizFeedbackTTS(text, config.TTS_VOICE_QA);
        const audioBuffer = audioUtils.pcmToWav(pcmBuffer);
        return { audioBuffer, mimeType: 'audio/wav' };
    } catch (geminiError) {
        console.error('[Quiz] Gemini TTS failed:', geminiError.message);
        throw new Error('Failed to generate audio with Gemini TTS');
    }
}

/**
 * Attach lip sync to audio
 */
async function attachLipSync(audioId, courseId = null) {
    const audioPath = fileUtils.getAudioFilePath(audioId, courseId, 'quiz');
    const lipSyncPath = fileUtils.getLipSyncFilePath(audioId, courseId, 'quiz');
    
    // Ensure directory exists
    if (courseId) {
        const lipSyncDir = require('path').dirname(lipSyncPath);
        await require('fs').promises.mkdir(lipSyncDir, { recursive: true });
    }
    
    try {
        await lipSyncService.generateLipSync(audioPath, lipSyncPath);
        return true;
    } catch (error) {
        console.warn('[Quiz] Lip sync generation failed:', error.message);
        return false;
    }
}

/**
 * Get quiz feedback with avatar audio
 * POST /api/courses/:courseId/chapters/:chapterId/quiz/feedback
 * Uses caching similar to chapter page audio
 */
async function getQuizFeedback(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const { feedbackText, score, totalQuestions, percentage, incorrectCount } = req.body;

        if (!feedbackText || !feedbackText.trim()) {
            return res.status(400).json({ error: 'Feedback text is required' });
        }

        // Create a cache key based on the feedback text (hash)
        const textHash = crypto.createHash('sha256').update(feedbackText.trim()).digest('hex').substring(0, 16);
        const cacheAudioId = `${constants.AUDIO_PREFIXES.QA}quiz-${textHash}`;

        // Check if cached audio exists (similar to getChapterPageAudio)
        let audioId = cacheAudioId;
        let lipSyncReady = false;
        let audioBuffer = null;
        let mimeType = 'audio/wav';

        try {
            // Check cache first (using new structure)
            if (await fileUtils.audioFileExists(cacheAudioId, courseId, 'quiz')) {
                console.log(`[Quiz] Serving cached audio for feedback: ${cacheAudioId}`);
                try {
                    audioBuffer = await fileUtils.readAudioFile(cacheAudioId, courseId, 'quiz');
                    const duration = await fileUtils.getAudioDuration(audioBuffer);
                    
                    // Determine MIME type (always WAV with Gemini TTS)
                    mimeType = 'audio/wav';
                    
                    // Check if lip sync exists
                    lipSyncReady = await fileUtils.lipSyncFileExists(cacheAudioId, courseId, 'quiz');
                    
                    console.log(`[Quiz] Cache hit - audio duration: ${duration}s, mimeType: ${mimeType}`);
                } catch (cacheError) {
                    console.warn(`[Quiz] Failed to read cached audio, regenerating. Error: ${cacheError.message}`);
                    // Fall through to regeneration
                }
            }

            // Generate new audio if cache miss
            if (!audioBuffer) {
                console.log(`[Quiz] Cache miss. Generating new audio for feedback: ${cacheAudioId}`);
                const feedbackAudio = await synthesizeFeedbackAudio(feedbackText);

                if (feedbackAudio?.audioBuffer) {
                    audioBuffer = feedbackAudio.audioBuffer;
                    mimeType = feedbackAudio.mimeType || 'audio/wav';
                    
                    // Save to cache (using new structure)
                    await fileUtils.saveAudioFile(cacheAudioId, audioBuffer, courseId, 'quiz');
                    console.log(`[Quiz] Saved audio to cache: ${cacheAudioId}`);
                    
                    // Generate lip sync
                    lipSyncReady = await attachLipSync(cacheAudioId, courseId);
                } else {
                    return res.status(500).json({ error: 'Erreur de génération audio.' });
                }
            }

            res.json({
                feedback: {
                    text: feedbackText,
                    audioUrl: audioId
                        ? `/api/courses/${courseId}/chapters/${chapterId}/quiz/audio/${audioId}`
                        : null,
                    audioId,
                    lipSyncUrl: lipSyncReady
                        ? `/api/courses/${courseId}/chapters/${chapterId}/quiz/lipsync/${audioId}`
                        : null,
                }
            });
        } catch (audioError) {
            console.error('[Quiz] Failed to prepare feedback audio:', audioError);
            return res.status(500).json({ 
                error: 'Erreur de génération audio.',
                details: audioError.message 
            });
        }
    } catch (error) {
        console.error('[Quiz] Feedback generation failed:', error);
        res.status(500).json({ 
            error: 'Impossible de générer le feedback.',
            details: error.message 
        });
    }
}

/**
 * Serve quiz feedback audio (WAV) from media
 * GET /api/courses/:courseId/chapters/:chapterId/quiz/audio/:audioId
 */
async function getQuizAudio(req, res) {
    try {
        const { courseId, chapterId, audioId } = req.params;
        const exists = await fileUtils.audioFileExists(audioId, courseId, 'quiz');
        if (!exists) {
            return res.status(404).json({ error: 'Audio not found' });
        }
        const buffer = await fileUtils.readAudioFile(audioId, courseId, 'quiz');
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('[Quiz] Audio GET error:', error);
        res.status(500).json({
            error: 'Failed to retrieve audio.',
            details: error.message
        });
    }
}

/**
 * Serve quiz feedback lip sync JSON
 * GET /api/courses/:courseId/chapters/:chapterId/quiz/lipsync/:audioId
 */
async function getQuizLipSync(req, res) {
    try {
        const { courseId, chapterId, audioId } = req.params;
        const data = await fileUtils.readLipSyncFile(audioId, courseId, 'quiz');
        if (!data) {
            return res.status(404).json({ error: 'Lip sync not found' });
        }
        res.setHeader('Content-Type', 'application/json');
        res.json(data);
    } catch (error) {
        console.error('[Quiz] Lip sync GET error:', error);
        res.status(500).json({
            error: 'Failed to retrieve lip sync.',
            details: error.message
        });
    }
}

module.exports = {
    getQuizQuestions,
    submitQuiz,
    getQuizAttempts,
    getQuizAttempt,
    getQuizAudio,
    getQuizLipSync,
    // Admin endpoints
    getQuizQuestionsAdmin,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    getQuizFeedback
};
