const dbUtils = require('../utils/dbUtils');

/**
 * Save or update chapter progress
 * POST /api/courses/:courseId/chapters/:chapterId/progress
 */
async function saveProgress(req, res) {
    try {
        const { courseId, chapterId } = req.params;
        const userId = req.session.userId;
        const { lastPageNumber, totalPages } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (lastPageNumber === undefined || totalPages === undefined) {
            return res.status(400).json({ error: 'lastPageNumber and totalPages are required' });
        }

        const pageNum = parseInt(lastPageNumber, 10);
        const total = parseInt(totalPages, 10);

        if (isNaN(pageNum) || pageNum < 0) {
            return res.status(400).json({ error: 'lastPageNumber must be a non-negative integer' });
        }

        if (isNaN(total) || total < 0) {
            return res.status(400).json({ error: 'totalPages must be a non-negative integer' });
        }

        const progress = await dbUtils.saveChapterProgress({
            userId,
            courseId,
            chapterId,
            lastPageNumber: pageNum,
            totalPages: total
        });

        res.json(progress);
    } catch (error) {
        console.error('[Progress Save Error]:', error);
        res.status(500).json({
            error: 'Failed to save progress.',
            details: error.message
        });
    }
}

/**
 * Get chapter progress for current user
 * GET /api/courses/:courseId/chapters/:chapterId/progress
 */
async function getChapterProgress(req, res) {
    try {
        const { chapterId } = req.params;
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const progress = await dbUtils.getChapterProgress(userId, chapterId);

        res.json(progress || {
            chapterId,
            lastPageNumber: 0,
            totalPages: 0,
            status: 'not_started',
            progressPercentage: 0
        });
    } catch (error) {
        console.error('[Chapter Progress Error]:', error);
        res.status(500).json({
            error: 'Failed to get chapter progress.',
            details: error.message
        });
    }
}

/**
 * Get all chapter progress for a course (current user)
 * GET /api/courses/:courseId/progress
 */
async function getCourseProgress(req, res) {
    try {
        const { courseId } = req.params;
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const [chapterProgress, summary, lastAccessed] = await Promise.all([
            dbUtils.getCourseChapterProgress(userId, courseId),
            dbUtils.getCourseProgressSummary(userId, courseId),
            dbUtils.getLastAccessedChapter(userId, courseId)
        ]);

        res.json({
            courseId,
            ...summary,
            lastAccessedChapter: lastAccessed,
            chapters: chapterProgress
        });
    } catch (error) {
        console.error('[Course Progress Error]:', error);
        res.status(500).json({
            error: 'Failed to get course progress.',
            details: error.message
        });
    }
}

module.exports = {
    saveProgress,
    getChapterProgress,
    getCourseProgress
};
