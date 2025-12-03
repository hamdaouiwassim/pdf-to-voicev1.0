const crypto = require('crypto');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const fileUtils = require('../utils/fileUtils');

/**
 * Create a new course
 * POST /api/courses
 */
async function createCourse(req, res) {
    try {
        const courseName = typeof req.body?.courseName === 'string' ? req.body.courseName.trim() : '';
        const courseDescription = typeof req.body?.courseDescription === 'string' ? req.body.courseDescription.trim() : '';

        if (!courseName) {
            return res.status(400).json({ error: 'Course name is required' });
        }

        if (courseName.length > 150) {
            return res.status(400).json({ error: 'Course name must be less than 150 characters' });
        }

        // Generate unique ID for the course
        const courseId = crypto.randomUUID();

        // Create course metadata
        const courseData = {
            id: courseId,
            courseName: courseName,
            courseDescription: courseDescription || null,
            chapters: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save course metadata
        await fileUtils.saveCourseMetadata(courseData);

        res.json({
            courseId: courseId,
            courseName: courseData.courseName,
            courseDescription: courseData.courseDescription,
            chapters: [],
            createdAt: courseData.createdAt
        });
    } catch (error) {
        console.error("[Course Create Error]:", error);
        res.status(500).json({
            error: 'Failed to create course.',
            details: error.message
        });
    }
}

/**
 * Get all courses
 * GET /api/courses
 */
async function getAllCourses(req, res) {
    try {
        const courses = await fileUtils.getAllCourses();
        res.json(courses);
    } catch (error) {
        console.error("[Courses List Error]:", error);
        res.status(500).json({
            error: 'Failed to list courses.',
            details: error.message
        });
    }
}

/**
 * Get a course by ID
 * GET /api/courses/:courseId
 */
async function getCourse(req, res) {
    try {
        const { courseId } = req.params;
        const course = await fileUtils.getCourseMetadata(courseId);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json(course);
    } catch (error) {
        console.error("[Course Get Error]:", error);
        res.status(500).json({
            error: 'Failed to get course.',
            details: error.message
        });
    }
}

/**
 * Update a course
 * PUT /api/courses/:courseId
 */
async function updateCourse(req, res) {
    try {
        const { courseId } = req.params;
        const courseName = typeof req.body?.courseName === 'string' ? req.body.courseName.trim() : '';
        const courseDescription = typeof req.body?.courseDescription === 'string' ? req.body.courseDescription.trim() : '';

        const course = await fileUtils.getCourseMetadata(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (courseName) {
            if (courseName.length > 150) {
                return res.status(400).json({ error: 'Course name must be less than 150 characters' });
            }
            course.courseName = courseName;
        }

        if (courseDescription !== undefined) {
            course.courseDescription = courseDescription || null;
        }

        course.updatedAt = new Date().toISOString();

        await fileUtils.saveCourseMetadata(course);

        res.json({
            courseId: course.id,
            courseName: course.courseName,
            courseDescription: course.courseDescription,
            chapters: course.chapters,
            updatedAt: course.updatedAt
        });
    } catch (error) {
        console.error("[Course Update Error]:", error);
        res.status(500).json({
            error: 'Failed to update course.',
            details: error.message
        });
    }
}

/**
 * Delete a course and all its chapters
 * DELETE /api/courses/:courseId
 */
async function deleteCourse(req, res) {
    try {
        const { courseId } = req.params;
        const deleted = await fileUtils.deleteCourseAssets(courseId);

        if (!deleted) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({
            message: 'Course deleted successfully',
            courseId
        });
    } catch (error) {
        console.error("[Course Delete Error]:", error);
        res.status(500).json({
            error: 'Failed to delete course.',
            details: error.message
        });
    }
}

module.exports = {
    createCourse,
    getAllCourses,
    getCourse,
    updateCourse,
    deleteCourse
};

