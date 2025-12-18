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
    const { id, courseName, courseDescription, courseImage } = courseData;
    
    try {
        await db.query(
            `INSERT INTO courses (id, course_name, course_description, course_image) 
             VALUES (?, ?, ?, ?)`,
            [id, courseName, courseDescription || null, courseImage || null]
        );
        
        console.log(`[DB] Course created successfully: ${id} - ${courseName}`);
        return await getCourseById(id);
    } catch (error) {
        console.error('[DB] Error creating course:', error);
        throw error;
    }
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
            c.course_image as courseImage,
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
        courseImage: course.courseImage,
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
            course_image as courseImage,
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
        courseImage: course.courseImage,
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
    
    if (updates.courseImage !== undefined) {
        fields.push('course_image = ?');
        values.push(updates.courseImage || null);
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
    
    if (updates.textFilename !== undefined) {
        fields.push('text_filename = ?');
        values.push(updates.textFilename || null);
    }
    
    if (updates.visualFilename !== undefined) {
        fields.push('visual_filename = ?');
        values.push(updates.visualFilename || null);
    }
    
    if (updates.statementsFilename !== undefined) {
        fields.push('statements_filename = ?');
        values.push(updates.statementsFilename || null);
    }
    
    if (updates.textLength !== undefined) {
        fields.push('text_length = ?');
        values.push(updates.textLength || 0);
    }
    
    if (updates.numPagesText !== undefined) {
        fields.push('num_pages_text = ?');
        values.push(updates.numPagesText || 0);
    }
    
    if (updates.numPagesVisual !== undefined) {
        fields.push('num_pages_visual = ?');
        values.push(updates.numPagesVisual || 0);
    }
    
    if (updates.numPagesStatements !== undefined) {
        fields.push('num_pages_statements = ?');
        values.push(updates.numPagesStatements || 0);
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

/**
 * Lab Database Operations
 */

/**
 * Create a new lab
 * @param {Object} labData - Lab data object
 * @returns {Promise<Object>} Created lab
 */
async function createLab(labData) {
    const { id, courseId, labName, labDescription, labType } = labData;
    
    try {
        await db.query(
            `INSERT INTO labs (id, course_id, lab_name, lab_description, lab_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, courseId, labName, labDescription || null, labType]
        );
        
        console.log(`[DB] Lab created successfully: ${id} - ${labName}`);
        return await getLabById(id);
    } catch (error) {
        console.error('[DB] Error creating lab:', error);
        throw error;
    }
}

/**
 * Get all labs from database
 * @returns {Promise<Array>} Array of labs with exercise count
 */
async function getAllLabs() {
    const labs = await db.query(
        `SELECT 
            l.id,
            l.course_id as courseId,
            l.lab_name as labName,
            l.lab_description as labDescription,
            l.lab_type as labType,
            COUNT(e.id) as exercisesCount,
            l.created_at as createdAt,
            l.updated_at as updatedAt,
            c.course_name as courseName
         FROM labs l
         LEFT JOIN exercises e ON l.id = e.lab_id
         LEFT JOIN courses c ON l.course_id = c.id
         GROUP BY l.id
         ORDER BY l.created_at DESC`
    );
    
    return labs.map(lab => ({
        id: lab.id,
        courseId: lab.courseId,
        courseName: lab.courseName,
        labName: lab.labName,
        labDescription: lab.labDescription,
        labType: lab.labType,
        exercisesCount: parseInt(lab.exercisesCount) || 0,
        createdAt: lab.createdAt,
        updatedAt: lab.updatedAt
    }));
}

/**
 * Get lab by ID
 * @param {string} labId - Lab ID
 * @returns {Promise<Object|null>} Lab object or null
 */
async function getLabById(labId) {
    const labs = await db.query(
        `SELECT 
            l.id,
            l.course_id as courseId,
            l.lab_name as labName,
            l.lab_description as labDescription,
            l.lab_type as labType,
            l.created_at as createdAt,
            l.updated_at as updatedAt,
            c.course_name as courseName
         FROM labs l
         LEFT JOIN courses c ON l.course_id = c.id
         WHERE l.id = ?`,
        [labId]
    );
    
    if (labs.length === 0) {
        return null;
    }
    
    return labs[0];
}

/**
 * Get labs by course ID
 * @param {string} courseId - Course ID
 * @returns {Promise<Array>} Array of labs
 */
async function getLabsByCourseId(courseId) {
    const labs = await db.query(
        `SELECT 
            l.id,
            l.course_id as courseId,
            l.lab_name as labName,
            l.lab_description as labDescription,
            l.lab_type as labType,
            COUNT(e.id) as exercisesCount,
            l.created_at as createdAt,
            l.updated_at as updatedAt
         FROM labs l
         LEFT JOIN exercises e ON l.id = e.lab_id
         WHERE l.course_id = ?
         GROUP BY l.id
         ORDER BY l.created_at DESC`,
        [courseId]
    );
    
    return labs.map(lab => ({
        id: lab.id,
        courseId: lab.courseId,
        labName: lab.labName,
        labDescription: lab.labDescription,
        labType: lab.labType,
        exercisesCount: parseInt(lab.exercisesCount) || 0,
        createdAt: lab.createdAt,
        updatedAt: lab.updatedAt
    }));
}

/**
 * Update lab
 * @param {string} labId - Lab ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated lab
 */
async function updateLab(labId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.labName !== undefined) {
        fields.push('lab_name = ?');
        values.push(updates.labName);
    }
    if (updates.labDescription !== undefined) {
        fields.push('lab_description = ?');
        values.push(updates.labDescription || null);
    }
    if (updates.labType !== undefined) {
        fields.push('lab_type = ?');
        values.push(updates.labType);
    }
    if (updates.courseId !== undefined) {
        fields.push('course_id = ?');
        values.push(updates.courseId);
    }
    
    if (fields.length === 0) {
        return await getLabById(labId);
    }
    
    values.push(labId);
    
    await db.query(
        `UPDATE labs SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    
    return await getLabById(labId);
}

/**
 * Delete lab
 * @param {string} labId - Lab ID
 * @returns {Promise<boolean>} True if lab was deleted
 */
async function deleteLab(labId) {
    const result = await db.query('DELETE FROM labs WHERE id = ?', [labId]);
    return result.affectedRows > 0;
}

/**
 * Exercise Database Operations
 */

/**
 * Create a new exercise
 * @param {Object} exerciseData - Exercise data object
 * @returns {Promise<Object>} Created exercise
 */
async function createExercise(exerciseData) {
    const { id, labId, exerciseName, exerciseDescription, pdfResource } = exerciseData;
    
    try {
        await db.query(
            `INSERT INTO exercises (id, lab_id, exercise_name, exercise_description, pdf_resource) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, labId, exerciseName, exerciseDescription || null, pdfResource || null]
        );
        
        console.log(`[DB] Exercise created successfully: ${id} - ${exerciseName}`);
        return await getExerciseById(id);
    } catch (error) {
        console.error('[DB] Error creating exercise:', error);
        throw error;
    }
}

/**
 * Get exercise by ID
 * @param {string} exerciseId - Exercise ID
 * @returns {Promise<Object|null>} Exercise object or null
 */
async function getExerciseById(exerciseId) {
    const exercises = await db.query(
        `SELECT 
            e.id,
            e.lab_id as labId,
            e.exercise_name as exerciseName,
            e.exercise_description as exerciseDescription,
            e.pdf_resource as pdfResource,
            e.created_at as createdAt,
            e.updated_at as updatedAt,
            l.lab_name as labName
         FROM exercises e
         LEFT JOIN labs l ON e.lab_id = l.id
         WHERE e.id = ?`,
        [exerciseId]
    );
    
    if (exercises.length === 0) {
        return null;
    }
    
    return exercises[0];
}

/**
 * Get exercises by lab ID
 * @param {string} labId - Lab ID
 * @returns {Promise<Array>} Array of exercises
 */
async function getExercisesByLabId(labId) {
    const exercises = await db.query(
        `SELECT DISTINCT
            id,
            lab_id as labId,
            exercise_name as exerciseName,
            exercise_description as exerciseDescription,
            pdf_resource as pdfResource,
            created_at as createdAt,
            updated_at as updatedAt
         FROM exercises 
         WHERE lab_id = ?
         ORDER BY created_at ASC`,
        [labId]
    );
    
    console.log(`[DB] Found ${exercises.length} exercises for lab ${labId}`);
    
    return exercises;
}

/**
 * Update exercise
 * @param {string} exerciseId - Exercise ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated exercise
 */
async function updateExercise(exerciseId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.exerciseName !== undefined) {
        fields.push('exercise_name = ?');
        values.push(updates.exerciseName);
    }
    if (updates.exerciseDescription !== undefined) {
        fields.push('exercise_description = ?');
        values.push(updates.exerciseDescription || null);
    }
    if (updates.pdfResource !== undefined) {
        fields.push('pdf_resource = ?');
        values.push(updates.pdfResource || null);
    }
    if (updates.labId !== undefined) {
        fields.push('lab_id = ?');
        values.push(updates.labId);
    }
    
    if (fields.length === 0) {
        return await getExerciseById(exerciseId);
    }
    
    values.push(exerciseId);
    
    await db.query(
        `UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    
    return await getExerciseById(exerciseId);
}

/**
 * Delete exercise
 * @param {string} exerciseId - Exercise ID
 * @returns {Promise<boolean>} True if exercise was deleted
 */
async function deleteExercise(exerciseId) {
    const result = await db.query('DELETE FROM exercises WHERE id = ?', [exerciseId]);
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
    deleteChapterImage,
    
    // Lab operations
    createLab,
    getAllLabs,
    getLabById,
    getLabsByCourseId,
    updateLab,
    deleteLab,
    
    // Exercise operations
    createExercise,
    getExerciseById,
    getExercisesByLabId,
    updateExercise,
    deleteExercise
};

