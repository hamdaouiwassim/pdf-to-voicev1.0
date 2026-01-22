const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const dbUtils = require('../utils/dbUtils');
const subscriptionUtils = require('../utils/subscriptionUtils');
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

        // Handle course image upload if provided
        let courseImageFilename = null;
        const courseImageFile = req.files?.courseImage;
        
        if (courseImageFile) {
            // Validate image file
            const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedImageTypes.includes(courseImageFile.mimetype)) {
                return res.status(400).json({ error: 'Course image must be a valid image file (JPEG, PNG, WebP, or GIF)' });
            }
            
            if (courseImageFile.size > 5 * 1024 * 1024) { // 5MB limit
                return res.status(400).json({ error: 'Course image must be less than 5MB' });
            }

            // Create course directory (media/{courseId}/uploads/courses/{courseId})
            const courseDir = fileUtils.getCourseUploadsCourseDir(courseId);
            await fs.mkdir(courseDir, { recursive: true });

            // Get file extension
            const ext = path.extname(courseImageFile.name) || '.jpg';
            courseImageFilename = `course_image${ext}`;
            const imagePath = path.join(courseDir, courseImageFilename);

            // Save image file
            await courseImageFile.mv(imagePath);
            console.log(`[Course] Saved course image: ${imagePath}`);
        }

        // Create course in database
        const course = await dbUtils.createCourse({
            id: courseId,
            courseName: courseName,
            courseDescription: courseDescription || null,
            courseImage: courseImageFilename
        });

        res.json({
            courseId: course.id,
            courseName: course.courseName,
            courseDescription: course.courseDescription,
            courseImage: course.courseImage,
            chapters: [],
            createdAt: course.createdAt
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
        const userId = req.session.userId;
        const userRole = req.session.role;
        
        const courses = await dbUtils.getAllCourses();
        
        // If user is not admin, add enrollment and subscription info
        if (userRole !== 'admin' && userId) {
            const enrolledCourses = await subscriptionUtils.getUserEnrolledCourses(userId);
            // Filter out any undefined/null enrollments and safely extract courseId
            const enrolledCourseIds = new Set(
                enrolledCourses
                    .filter(c => c && c.courseId)
                    .map(c => c.courseId)
            );

            // Compute once per request to avoid repeated queries
            const userHasActiveSubscription = await subscriptionUtils.hasActiveSubscription(userId);
            
            const coursesWithEnrollment = await Promise.all(courses.map(async (course) => {
                if (!course || !course.id) {
                    return course; // Skip invalid courses
                }
                
                const isEnrolledFromDb = enrolledCourseIds.has(course.id);
                let subscriptions = [];
                try {
                    subscriptions = await subscriptionUtils.getSubscriptionsForCourse(course.id);
                } catch (subError) {
                    console.error(`[Course Controller] Error getting subscriptions for course ${course.id}:`, subError);
                    subscriptions = [];
                }
                
                const activeSubsForCourse = subscriptions.filter(s => s && s.isActive);

                // If user has an active subscription that includes this course but isn't enrolled yet,
                // mark as enrolled so the UI can start the course (middleware will auto-enroll on access).
                const isEnrolled = isEnrolledFromDb || (userHasActiveSubscription && activeSubsForCourse.length > 0);
                
                return {
                    ...course,
                    isEnrolled,
                    canEnroll: false, // enrollment handled by admin/subscription; no self-enroll on frontend
                    subscriptions: activeSubsForCourse,
                    userHasActiveSubscription: userHasActiveSubscription
                };
            }));
            
            return res.json(coursesWithEnrollment);
        }
        
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
        const course = await dbUtils.getCourseById(courseId);

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

        const existingCourse = await dbUtils.getCourseById(courseId);
        if (!existingCourse) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (courseName && courseName.length > 150) {
            return res.status(400).json({ error: 'Course name must be less than 150 characters' });
        }

        const updates = {};
        if (courseName) updates.courseName = courseName;
        if (courseDescription !== undefined) updates.courseDescription = courseDescription;

        // Handle course image upload if provided
        const courseImageFile = req.files?.courseImage;
        if (courseImageFile) {
            // Validate image file
            const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedImageTypes.includes(courseImageFile.mimetype)) {
                return res.status(400).json({ error: 'Course image must be a valid image file (JPEG, PNG, WebP, or GIF)' });
            }
            
            if (courseImageFile.size > 5 * 1024 * 1024) { // 5MB limit
                return res.status(400).json({ error: 'Course image must be less than 5MB' });
            }

            // Create course directory if it doesn't exist (media layout)
            const courseDir = fileUtils.getCourseUploadsCourseDir(courseId);
            await fs.mkdir(courseDir, { recursive: true });

            // Delete old image if it exists
            if (existingCourse.courseImage) {
                const oldImagePath = path.join(courseDir, existingCourse.courseImage);
                try {
                    await fs.unlink(oldImagePath);
                } catch (error) {
                    // Ignore if file doesn't exist
                    if (error.code !== 'ENOENT') {
                        console.warn(`[Course] Failed to delete old image: ${error.message}`);
                    }
                }
            }

            // Get file extension
            const ext = path.extname(courseImageFile.name) || '.jpg';
            const courseImageFilename = `course_image${ext}`;
            const imagePath = path.join(courseDir, courseImageFilename);

            // Save new image file
            await courseImageFile.mv(imagePath);
            updates.courseImage = courseImageFilename;
            console.log(`[Course] Updated course image: ${imagePath}`);
        }

        const course = await dbUtils.updateCourse(courseId, updates);

        res.json({
            courseId: course.id,
            courseName: course.courseName,
            courseDescription: course.courseDescription,
            courseImage: course.courseImage,
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
        const deleted = await dbUtils.deleteCourse(courseId);

        if (!deleted) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Note: File deletion should be handled separately if needed
        // The database cascade will delete chapters and images records

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

