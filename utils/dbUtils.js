/**
 * Database utility functions for courses and chapters
 * Handles all database operations for courses, chapters, and images
 */

const db = require('../config/database');

/**
 * Course Database Operations
 */

/**
 * Create a new course in the database
 * @param {Object} courseData - Course data object
 * @returns {Promise<Object>} Created course
 */
async function createCourse(courseData) {
    const { id, courseName, courseDescription } = courseData;
    
    await db.query(
        `INSERT INTO courses (id, course_name, course_description) 
         VALUES (?, ?, ?)`,
        [id, courseName, courseDescription || null]
    );
    
    return await getCourseById(id);
}

/**
 * Get all courses from database
 * @returns {Promise<Array>} Array of courses with chapter count
 */
async function getAllCourses() {
    const courses = await db.query(
        `SELECT 
            c.id,
            c.course_name as courseName,
            c.course_description as courseDescription,
            COUNT(ch.id) as chaptersCount,
            c.created_at as createdAt,
            c.updated_at as updatedAt
         FROM courses c
         LEFT JOIN chapters ch ON c.id = ch.course_id
         GROUP BY c.id
         ORDER BY c.created_at DESC`
    );
    
    return courses.map(course => ({
        id: course.id,
        courseName: course.courseName,
        courseDescription: course.courseDescription,
        chaptersCount: parseInt(course.chaptersCount) || 0,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
    }));
}

/**
 * Get course by ID
 * @param {string} courseId - Course ID
 * @returns {Promise<Object|null>} Course object or null
 */
async function getCourseById(courseId) {
    const courses = await db.query(
        `SELECT 
            id,
            course_name as courseName,
            course_description as courseDescription,
            created_at as createdAt,
            updated_at as updatedAt
         FROM courses 
         WHERE id = ?`,
        [courseId]
    );
    
    if (courses.length === 0) {
        return null;
    }
    
    const course = courses[0];
    
    // Get chapters for this course
    const chapters = await db.query(
        `SELECT 
            id,
            chapter_name as chapterName,
            chapter_description as chapterDescription,
            video_link as videoLink,
            created_at as createdAt
         FROM chapters 
         WHERE course_id = ?
         ORDER BY created_at ASC`,
        [courseId]
    );
    
    return {
        id: course.id,
        courseName: course.courseName,
        courseDescription: course.courseDescription,
        chapters: chapters.map(ch => ({
            id: ch.id,
            chapterName: ch.chapterName,
            chapterDescription: ch.chapterDescription,
            videoLink: ch.videoLink,
            createdAt: ch.createdAt
        })),
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
    };
}

/**
 * Update course in database
 * @param {string} courseId - Course ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated course
 */
async function updateCourse(courseId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.courseName !== undefined) {
        fields.push('course_name = ?');
        values.push(updates.courseName);
    }
    
    if (updates.courseDescription !== undefined) {
        fields.push('course_description = ?');
        values.push(updates.courseDescription || null);
    }
    
    if (fields.length === 0) {
        return await getCourseById(courseId);
    }
    
    values.push(courseId);
    
    await db.query(
        `UPDATE courses SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    
    return await getCourseById(courseId);
}

/**
 * Delete course and all its chapters (cascade will handle chapters and images)
 * @param {string} courseId - Course ID
 * @returns {Promise<boolean>} True if course was deleted
 */
async function deleteCourse(courseId) {
    const result = await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
    return result.affectedRows > 0;
}

/**
 * Chapter Database Operations
 */

/**
 * Create a new chapter in the database
 * @param {Object} chapterData - Chapter data object
 * @returns {Promise<Object>} Created chapter
 */
async function createChapter(chapterData) {
    const {
        id,
        courseId,
        chapterName,
        chapterDescription,
        videoLink,
        textContent,
        textFilename,
        visualFilename,
        statementsFilename,
        textLength,
        numPagesText,
        numPagesVisual,
        numPagesStatements,
        statementsCount,
        statements
    } = chapterData;
    
    await db.query(
        `INSERT INTO chapters (
            id, course_id, chapter_name, chapter_description, video_link,
            text_content, text_filename, visual_filename, statements_filename,
            text_length, num_pages_text, num_pages_visual, num_pages_statements,
            statements_count, statements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            courseId,
            chapterName,
            chapterDescription || null,
            videoLink || null,
            textContent || null,
            textFilename || null,
            visualFilename || null,
            statementsFilename || null,
            textLength || 0,
            numPagesText || 0,
            numPagesVisual || 0,
            numPagesStatements || 0,
            statementsCount || 0,
            statements ? JSON.stringify(statements) : null
        ]
    );
    
    return await getChapterById(courseId, id);
}

/**
 * Get chapter by ID
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Object|null>} Chapter object or null
 */
async function getChapterById(courseId, chapterId) {
    const chapters = await db.query(
        `SELECT 
            id,
            course_id as courseId,
            chapter_name as chapterName,
            chapter_description as chapterDescription,
            video_link as videoLink,
            text_content as textContent,
            text_filename as textFilename,
            visual_filename as visualFilename,
            statements_filename as statementsFilename,
            text_length as textLength,
            num_pages_text as numPagesText,
            num_pages_visual as numPagesVisual,
            num_pages_statements as numPagesStatements,
            statements_count as statementsCount,
            statements,
            created_at as createdAt,
            updated_at as updatedAt
         FROM chapters 
         WHERE id = ? AND course_id = ?`,
        [chapterId, courseId]
    );
    
    if (chapters.length === 0) {
        return null;
    }
    
    const chapter = chapters[0];
    
    // Parse statements JSON
    if (chapter.statements) {
        try {
            chapter.statements = JSON.parse(chapter.statements);
        } catch (e) {
            chapter.statements = [];
        }
    } else {
        chapter.statements = [];
    }
    
    // Get images for this chapter
    const images = await getChapterImages(chapterId);
    chapter.webpImages = images.map(img => img.image_path);
    
    return chapter;
}

/**
 * Get all chapters for a course
 * @param {string} courseId - Course ID
 * @returns {Promise<Array>} Array of chapters
 */
async function getChaptersByCourseId(courseId) {
    const chapters = await db.query(
        `SELECT 
            id,
            chapter_name as chapterName,
            chapter_description as chapterDescription,
            video_link as videoLink,
            num_pages_text as numPagesText,
            num_pages_visual as numPagesVisual,
            num_pages_statements as numPagesStatements,
            statements_count as statementsCount,
            created_at as createdAt
         FROM chapters 
         WHERE course_id = ?
         ORDER BY created_at ASC`,
        [courseId]
    );
    
    // Get images for each chapter
    const chaptersWithImages = await Promise.all(
        chapters.map(async (chapter) => {
            const images = await getChapterImages(chapter.id);
            return {
                ...chapter,
                webpImages: images.map(img => img.image_path),
                webpConversionStatus: images.length > 0 ? 'completed' : 'pending'
            };
        })
    );
    
    return chaptersWithImages;
}

/**
 * Update chapter in database
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated chapter
 */
async function updateChapter(courseId, chapterId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.chapterName !== undefined) {
        fields.push('chapter_name = ?');
        values.push(updates.chapterName);
    }
    
    if (updates.chapterDescription !== undefined) {
        fields.push('chapter_description = ?');
        values.push(updates.chapterDescription || null);
    }
    
    if (updates.videoLink !== undefined) {
        fields.push('video_link = ?');
        values.push(updates.videoLink || null);
    }
    
    if (updates.textContent !== undefined) {
        fields.push('text_content = ?');
        values.push(updates.textContent || null);
    }
    
    if (updates.statements !== undefined) {
        fields.push('statements = ?');
        fields.push('statements_count = ?');
        values.push(updates.statements ? JSON.stringify(updates.statements) : null);
        values.push(updates.statements ? updates.statements.length : 0);
    }
    
    if (fields.length === 0) {
        return await getChapterById(courseId, chapterId);
    }
    
    values.push(chapterId, courseId);
    
    await db.query(
        `UPDATE chapters SET ${fields.join(', ')} WHERE id = ? AND course_id = ?`,
        values
    );
    
    return await getChapterById(courseId, chapterId);
}

/**
 * Delete chapter
 * @param {string} courseId - Course ID
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<boolean>} True if chapter was deleted
 */
async function deleteChapter(courseId, chapterId) {
    const result = await db.query(
        'DELETE FROM chapters WHERE id = ? AND course_id = ?',
        [chapterId, courseId]
    );
    return result.affectedRows > 0;
}

/**
 * Chapter Images Database Operations
 */

/**
 * Add image to chapter
 * @param {string} chapterId - Chapter ID
 * @param {Object} imageData - Image data
 * @returns {Promise<Object>} Created image record
 */
async function addChapterImage(chapterId, imageData) {
    const {
        imagePath,
        pageNumber,
        imageType = 'webp',
        fileSize,
        width,
        height
    } = imageData;
    
    await db.query(
        `INSERT INTO chapter_images (
            chapter_id, image_path, page_number, image_type, file_size, width, height
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [chapterId, imagePath, pageNumber || null, imageType, fileSize || null, width || null, height || null]
    );
    
    const images = await getChapterImages(chapterId);
    return images[images.length - 1];
}

/**
 * Get all images for a chapter
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Array>} Array of image records
 */
async function getChapterImages(chapterId) {
    return await db.query(
        `SELECT 
            id,
            chapter_id as chapterId,
            image_path as imagePath,
            page_number as pageNumber,
            image_type as imageType,
            file_size as fileSize,
            width,
            height,
            created_at as createdAt
         FROM chapter_images 
         WHERE chapter_id = ?
         ORDER BY page_number ASC, created_at ASC`,
        [chapterId]
    );
}

/**
 * Delete all images for a chapter
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<number>} Number of deleted images
 */
async function deleteChapterImages(chapterId) {
    const result = await db.query('DELETE FROM chapter_images WHERE chapter_id = ?', [chapterId]);
    return result.affectedRows;
}

/**
 * Delete a specific image
 * @param {number} imageId - Image ID
 * @returns {Promise<boolean>} True if image was deleted
 */
async function deleteChapterImage(imageId) {
    const result = await db.query('DELETE FROM chapter_images WHERE id = ?', [imageId]);
    return result.affectedRows > 0;
}

module.exports = {
    // Course operations
    createCourse,
    getAllCourses,
    getCourseById,
    updateCourse,
    deleteCourse,
    
    // Chapter operations
    createChapter,
    getChapterById,
    getChaptersByCourseId,
    updateChapter,
    deleteChapter,
    
    // Image operations
    addChapterImage,
    getChapterImages,
    deleteChapterImages,
    deleteChapterImage
};

