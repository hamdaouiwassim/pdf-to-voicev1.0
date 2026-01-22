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
 * Get chapter text content by ID (without needing courseId)
 * Useful for TTS where we only have the docId/chapterId
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<string | null>} Chapter text or null if not found
 */
async function getChapterTextById(chapterId) {
    const chapters = await db.query(
        'SELECT text_content FROM chapters WHERE id = ?',
        [chapterId]
    );

    if (chapters.length === 0) {
        return null;
    }

    return chapters[0].text_content;
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

/**
 * Final Project Database Operations
 */

/**
 * Create a new final project
 * @param {Object} projectData - Final project data
 * @returns {Promise<Object>} Created final project
 */
async function createFinalProject(projectData) {
    const { id, courseId, projectName, projectDescription } = projectData;

    try {
        await db.query(
            `INSERT INTO final_projects (id, course_id, project_name, project_description) 
             VALUES (?, ?, ?, ?)`,
            [id, courseId, projectName, projectDescription || null]
        );

        console.log(`[DB] Final project created: ${id} - ${projectName}`);
        return await getFinalProjectById(id);
    } catch (error) {
        console.error('[DB] Error creating final project:', error);
        throw error;
    }
}

/**
 * Get final project by ID
 * @param {string} projectId - Final project ID
 * @returns {Promise<Object|null>} Final project or null
 */
async function getFinalProjectById(projectId) {
    try {
        const projects = await db.query(
            `SELECT 
                id,
                course_id as courseId,
                project_name as projectName,
                project_description as projectDescription,
                created_at as createdAt,
                updated_at as updatedAt
             FROM final_projects 
             WHERE id = ?`,
            [projectId]
        );

        if (projects.length === 0) {
            return null;
        }

        return {
            id: projects[0].id,
            courseId: projects[0].courseId,
            projectName: projects[0].projectName,
            projectDescription: projects[0].projectDescription,
            createdAt: projects[0].createdAt,
            updatedAt: projects[0].updatedAt
        };
    } catch (error) {
        console.error('[DB] Error getting final project:', error);
        throw error;
    }
}

/**
 * Get final project by course ID
 * @param {string} courseId - Course ID
 * @returns {Promise<Object|null>} Final project or null
 */
async function getFinalProjectByCourseId(courseId) {
    try {
        const projects = await db.query(
            `SELECT 
                id,
                course_id as courseId,
                project_name as projectName,
                project_description as projectDescription,
                created_at as createdAt,
                updated_at as updatedAt
             FROM final_projects 
             WHERE course_id = ?`,
            [courseId]
        );

        if (projects.length === 0) {
            return null;
        }

        return {
            id: projects[0].id,
            courseId: projects[0].courseId,
            projectName: projects[0].projectName,
            projectDescription: projects[0].projectDescription,
            createdAt: projects[0].createdAt,
            updatedAt: projects[0].updatedAt
        };
    } catch (error) {
        console.error('[DB] Error getting final project by course:', error);
        throw error;
    }
}

/**
 * Update final project
 * @param {string} projectId - Final project ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated final project
 */
async function updateFinalProject(projectId, updates) {
    const fields = [];
    const values = [];

    if (updates.projectName !== undefined) {
        fields.push('project_name = ?');
        values.push(updates.projectName);
    }
    if (updates.projectDescription !== undefined) {
        fields.push('project_description = ?');
        values.push(updates.projectDescription);
    }

    if (fields.length === 0) {
        return await getFinalProjectById(projectId);
    }

    values.push(projectId);

    try {
        await db.query(
            `UPDATE final_projects 
             SET ${fields.join(', ')} 
             WHERE id = ?`,
            values
        );

        return await getFinalProjectById(projectId);
    } catch (error) {
        console.error('[DB] Error updating final project:', error);
        throw error;
    }
}

/**
 * Delete final project
 * @param {string} projectId - Final project ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteFinalProject(projectId) {
    try {
        const result = await db.query(
            `DELETE FROM final_projects WHERE id = ?`,
            [projectId]
        );

        return result.affectedRows > 0;
    } catch (error) {
        console.error('[DB] Error deleting final project:', error);
        throw error;
    }
}

/**
 * Create a final project document
 * @param {Object} documentData - Document data
 * @returns {Promise<Object>} Created document
 */
async function createFinalProjectDocument(documentData) {
    const { id, finalProjectId, documentName, documentDescription, pdfResource } = documentData;

    try {
        await db.query(
            `INSERT INTO final_project_documents (id, final_project_id, document_name, document_description, pdf_resource) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, finalProjectId, documentName, documentDescription || null, pdfResource || null]
        );

        return await getFinalProjectDocumentById(id);
    } catch (error) {
        console.error('[DB] Error creating final project document:', error);
        throw error;
    }
}

/**
 * Get final project document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object|null>} Document or null
 */
async function getFinalProjectDocumentById(documentId) {
    try {
        const documents = await db.query(
            `SELECT 
                id,
                final_project_id as finalProjectId,
                document_name as documentName,
                document_description as documentDescription,
                pdf_resource as pdfResource,
                created_at as createdAt,
                updated_at as updatedAt
             FROM final_project_documents 
             WHERE id = ?`,
            [documentId]
        );

        if (documents.length === 0) {
            return null;
        }

        return {
            id: documents[0].id,
            finalProjectId: documents[0].finalProjectId,
            documentName: documents[0].documentName,
            documentDescription: documents[0].documentDescription,
            pdfResource: documents[0].pdfResource,
            createdAt: documents[0].createdAt,
            updatedAt: documents[0].updatedAt
        };
    } catch (error) {
        console.error('[DB] Error getting final project document:', error);
        throw error;
    }
}

/**
 * Get all documents for a final project
 * @param {string} finalProjectId - Final project ID
 * @returns {Promise<Array>} Array of documents
 */
async function getFinalProjectDocuments(finalProjectId) {
    try {
        const documents = await db.query(
            `SELECT 
                id,
                final_project_id as finalProjectId,
                document_name as documentName,
                document_description as documentDescription,
                pdf_resource as pdfResource,
                created_at as createdAt,
                updated_at as updatedAt
             FROM final_project_documents 
             WHERE final_project_id = ?
             ORDER BY created_at ASC`,
            [finalProjectId]
        );

        return documents.map(doc => ({
            id: doc.id,
            finalProjectId: doc.finalProjectId,
            documentName: doc.documentName,
            documentDescription: doc.documentDescription,
            pdfResource: doc.pdfResource,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        }));
    } catch (error) {
        console.error('[DB] Error getting final project documents:', error);
        throw error;
    }
}

/**
 * Update final project document
 * @param {string} documentId - Document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated document
 */
async function updateFinalProjectDocument(documentId, updates) {
    const fields = [];
    const values = [];

    if (updates.documentName !== undefined) {
        fields.push('document_name = ?');
        values.push(updates.documentName);
    }
    if (updates.documentDescription !== undefined) {
        fields.push('document_description = ?');
        values.push(updates.documentDescription);
    }
    if (updates.pdfResource !== undefined) {
        fields.push('pdf_resource = ?');
        values.push(updates.pdfResource);
    }

    if (fields.length === 0) {
        return await getFinalProjectDocumentById(documentId);
    }

    values.push(documentId);

    try {
        await db.query(
            `UPDATE final_project_documents 
             SET ${fields.join(', ')} 
             WHERE id = ?`,
            values
        );

        return await getFinalProjectDocumentById(documentId);
    } catch (error) {
        console.error('[DB] Error updating final project document:', error);
        throw error;
    }
}

/**
 * Delete final project document
 * @param {string} documentId - Document ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteFinalProjectDocument(documentId) {
    try {
        const result = await db.query(
            `DELETE FROM final_project_documents WHERE id = ?`,
            [documentId]
        );

        return result.affectedRows > 0;
    } catch (error) {
        console.error('[DB] Error deleting final project document:', error);
        throw error;
    }
}

/**
 * Create final project submission
 * @param {Object} submissionData - Submission data
 * @returns {Promise<Object>} Created submission
 */
async function createFinalProjectSubmission(submissionData) {
    try {
        const { id, finalProjectId, userEmail, fileResource, comment } = submissionData;
        
        await db.query(
            `INSERT INTO final_project_submissions (id, final_project_id, user_email, file_resource, comment) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, finalProjectId, userEmail, fileResource || null, comment || null]
        );

        return await getFinalProjectSubmissionById(id);
    } catch (error) {
        console.error('[DB] Error creating final project submission:', error);
        throw error;
    }
}

/**
 * Get final project submission by ID
 * @param {string} submissionId - Submission ID
 * @returns {Promise<Object|null>} Submission or null
 */
async function getFinalProjectSubmissionById(submissionId) {
    try {
        const submissions = await db.query(
            `SELECT 
                id,
                final_project_id as finalProjectId,
                user_email as userEmail,
                file_resource as fileResource,
                comment,
                submitted_at as submittedAt,
                updated_at as updatedAt
             FROM final_project_submissions 
             WHERE id = ?`,
            [submissionId]
        );

        if (submissions.length === 0) {
            return null;
        }

        return {
            id: submissions[0].id,
            finalProjectId: submissions[0].finalProjectId,
            userEmail: submissions[0].userEmail,
            fileResource: submissions[0].fileResource,
            comment: submissions[0].comment,
            submittedAt: submissions[0].submittedAt,
            updatedAt: submissions[0].updatedAt
        };
    } catch (error) {
        console.error('[DB] Error getting final project submission:', error);
        throw error;
    }
}

/**
 * Get final project submission by project ID and user email
 * @param {string} finalProjectId - Final project ID
 * @param {string} userEmail - User email
 * @returns {Promise<Object|null>} Submission or null
 */
async function getFinalProjectSubmissionByUser(finalProjectId, userEmail) {
    try {
        const submissions = await db.query(
            `SELECT 
                id,
                final_project_id as finalProjectId,
                user_email as userEmail,
                file_resource as fileResource,
                comment,
                submitted_at as submittedAt,
                updated_at as updatedAt
             FROM final_project_submissions 
             WHERE final_project_id = ? AND user_email = ?`,
            [finalProjectId, userEmail]
        );

        if (submissions.length === 0) {
            return null;
        }

        return {
            id: submissions[0].id,
            finalProjectId: submissions[0].finalProjectId,
            userEmail: submissions[0].userEmail,
            fileResource: submissions[0].fileResource,
            comment: submissions[0].comment,
            submittedAt: submissions[0].submittedAt,
            updatedAt: submissions[0].updatedAt
        };
    } catch (error) {
        console.error('[DB] Error getting final project submission by user:', error);
        throw error;
    }
}

/**
 * Update final project submission
 * @param {string} submissionId - Submission ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated submission
 */
async function updateFinalProjectSubmission(submissionId, updates) {
    const fields = [];
    const values = [];

    if (updates.fileResource !== undefined) {
        fields.push('file_resource = ?');
        values.push(updates.fileResource);
    }
    if (updates.comment !== undefined) {
        fields.push('comment = ?');
        values.push(updates.comment);
    }

    if (fields.length === 0) {
        return await getFinalProjectSubmissionById(submissionId);
    }

    values.push(submissionId);

    try {
        await db.query(
            `UPDATE final_project_submissions 
             SET ${fields.join(', ')} 
             WHERE id = ?`,
            values
        );

        return await getFinalProjectSubmissionById(submissionId);
    } catch (error) {
        console.error('[DB] Error updating final project submission:', error);
        throw error;
    }
}

/**
 * Delete final project submission
 * @param {string} submissionId - Submission ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteFinalProjectSubmission(submissionId) {
    try {
        const result = await db.query(
            `DELETE FROM final_project_submissions WHERE id = ?`,
            [submissionId]
        );

        return result.affectedRows > 0;
    } catch (error) {
        console.error('[DB] Error deleting final project submission:', error);
        throw error;
    }
}

/**
 * Quiz Database Operations
 */

/**
 * Create a quiz question
 * @param {Object} questionData - Question data object
 * @returns {Promise<Object>} Created question
 */
async function createQuizQuestion(questionData) {
    const {
        id,
        chapterId,
        questionText,
        options,
        questionType = 'single',
        correctAnswerIndex,
        correctAnswerIndices,
        explanation,
        orderIndex
    } = questionData;

    // Validate and prepare options
    if (!Array.isArray(options)) {
        console.error('[DB] Options is not an array:', typeof options, options);
        throw new Error('Options must be an array');
    }

    if (options.length < 2) {
        console.error('[DB] Not enough options:', options);
        throw new Error('At least 2 options are required');
    }

    // Ensure all options are strings and not empty
    const validOptions = options
        .map(opt => {
            if (typeof opt !== 'string') {
                return String(opt);
            }
            return opt.trim();
        })
        .filter(opt => opt.length > 0);

    if (validOptions.length < 2) {
        console.error('[DB] Not enough valid options after filtering:', validOptions);
        throw new Error('At least 2 non-empty options are required');
    }

    // Stringify options to JSON
    const optionsJson = JSON.stringify(validOptions);
    
    // Verify JSON stringification worked
    try {
        const testParse = JSON.parse(optionsJson);
        if (!Array.isArray(testParse) || testParse.length !== validOptions.length) {
            throw new Error('JSON stringification verification failed');
        }
    } catch (e) {
        console.error('[DB] JSON stringification failed:', e);
        throw new Error('Failed to stringify options to JSON');
    }
    
    // Validate question type and correct answers
    const isMultiple = questionType === 'multiple';
    
    if (isMultiple) {
        if (!Array.isArray(correctAnswerIndices) || correctAnswerIndices.length === 0) {
            throw new Error('Multiple-choice questions require at least one correct answer index');
        }
        // Validate all indices are valid
        const invalidIndices = correctAnswerIndices.filter(idx => 
            isNaN(idx) || idx < 0 || idx >= validOptions.length
        );
        if (invalidIndices.length > 0) {
            throw new Error(`Invalid correct answer indices: ${invalidIndices.join(', ')}`);
        }
    } else {
        if (correctAnswerIndex === undefined || correctAnswerIndex === null || 
            isNaN(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= validOptions.length) {
            throw new Error(`Invalid correctAnswerIndex: must be between 0 and ${validOptions.length - 1}`);
        }
    }

    console.log('[DB] Saving question with options:', {
        id,
        chapterId,
        questionType: isMultiple ? 'multiple' : 'single',
        optionsCount: validOptions.length,
        optionsJson: optionsJson,
        optionsJsonLength: optionsJson.length,
        correctAnswerIndex: isMultiple ? null : correctAnswerIndex,
        correctAnswerIndices: isMultiple ? correctAnswerIndices : null,
        validOptions: validOptions
    });

    try {
        const correctIndicesJson = isMultiple ? JSON.stringify(correctAnswerIndices) : null;
        
        await db.query(
            `INSERT INTO quiz_questions (
                id, chapter_id, question_text, options, question_type,
                correct_answer_index, correct_answer_indices,
                explanation, order_index
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                chapterId,
                questionText,
                optionsJson,
                isMultiple ? 'multiple' : 'single',
                isMultiple ? null : correctAnswerIndex,
                correctIndicesJson,
                explanation || null,
                orderIndex || 0
            ]
        );

        // Verify the question was saved correctly by querying directly
        const verifyQuery = await db.query(
            `SELECT options, question_text FROM quiz_questions WHERE id = ?`,
            [id]
        );

        if (verifyQuery.length === 0) {
            throw new Error('Question was not inserted into database');
        }

        const rawOptions = verifyQuery[0].options;
        console.log('[DB] Raw options from database:', {
            type: typeof rawOptions,
            value: rawOptions,
            isString: typeof rawOptions === 'string',
            isArray: Array.isArray(rawOptions)
        });

        // Verify the question was saved correctly
        const savedQuestion = await getQuizQuestionById(id);
        if (!savedQuestion) {
            throw new Error('Failed to retrieve saved question');
        }

        console.log('[DB] Question saved successfully:', {
            id: savedQuestion.id,
            optionsCount: savedQuestion.options ? savedQuestion.options.length : 0,
            options: savedQuestion.options,
            rawOptionsFromDB: rawOptions
        });

        // Double-check options are present
        if (!savedQuestion.options || !Array.isArray(savedQuestion.options) || savedQuestion.options.length === 0) {
            console.error('[DB] WARNING: Options are missing or empty after save!', {
                savedQuestion,
                rawOptions
            });
            throw new Error('Options were not saved correctly to the database');
        }

        return savedQuestion;
    } catch (error) {
        console.error('[DB] Error saving quiz question:', error);
        console.error('[DB] Query params:', {
            id,
            chapterId,
            questionText: questionText ? questionText.substring(0, 50) : null,
            optionsJson: optionsJson.substring(0, 100),
            correctAnswerIndex,
            explanation: explanation ? explanation.substring(0, 50) : null,
            orderIndex
        });
        throw error;
    }
}

/**
 * Get quiz question by ID
 * @param {string} questionId - Question ID
 * @returns {Promise<Object|null>} Question object or null
 */
async function getQuizQuestionById(questionId) {
    const questions = await db.query(
        `SELECT 
            id,
            chapter_id as chapterId,
            question_text as questionText,
            options,
            question_type as questionType,
            correct_answer_index as correctAnswerIndex,
            correct_answer_indices as correctAnswerIndices,
            explanation,
            order_index as orderIndex,
            created_at as createdAt,
            updated_at as updatedAt
         FROM quiz_questions 
         WHERE id = ?`,
        [questionId]
    );

    if (questions.length === 0) {
        return null;
    }

    const question = questions[0];
    
    // Parse options JSON
    // MySQL JSON columns might return as object or string depending on driver/version
    if (question.options) {
        if (typeof question.options === 'string') {
            try {
                question.options = JSON.parse(question.options);
            } catch (e) {
                console.error('[DB] Error parsing options JSON:', e, 'Raw value:', question.options);
                question.options = [];
            }
        } else if (Array.isArray(question.options)) {
            // Already parsed by MySQL driver
            question.options = question.options;
        } else {
            console.warn('[DB] Options is not string or array:', typeof question.options, question.options);
            question.options = [];
        }
    } else {
        question.options = [];
    }

    // Parse correct_answer_indices JSON for multiple-choice questions
    if (question.questionType === 'multiple' && question.correctAnswerIndices) {
        if (typeof question.correctAnswerIndices === 'string') {
            try {
                question.correctAnswerIndices = JSON.parse(question.correctAnswerIndices);
            } catch (e) {
                console.error('[DB] Error parsing correctAnswerIndices JSON:', e);
                question.correctAnswerIndices = [];
            }
        } else if (Array.isArray(question.correctAnswerIndices)) {
            // Already parsed
            question.correctAnswerIndices = question.correctAnswerIndices;
        }
    } else if (question.questionType === 'multiple') {
        question.correctAnswerIndices = [];
    }

    // Set default question type if not set (for backward compatibility)
    if (!question.questionType) {
        question.questionType = 'single';
    }

    console.log('[DB] Retrieved question:', {
        id: question.id,
        questionType: question.questionType,
        optionsCount: Array.isArray(question.options) ? question.options.length : 0,
        correctAnswerIndex: question.correctAnswerIndex,
        correctAnswerIndices: question.correctAnswerIndices
    });

    return question;
}

/**
 * Get all quiz questions for a chapter
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Array>} Array of questions
 */
async function getQuizQuestionsByChapterId(chapterId) {
    const questions = await db.query(
        `SELECT 
            id,
            chapter_id as chapterId,
            question_text as questionText,
            options,
            question_type as questionType,
            correct_answer_index as correctAnswerIndex,
            correct_answer_indices as correctAnswerIndices,
            explanation,
            order_index as orderIndex,
            created_at as createdAt,
            updated_at as updatedAt
         FROM quiz_questions 
         WHERE chapter_id = ?
         ORDER BY order_index ASC, created_at ASC`,
        [chapterId]
    );

    // Parse options JSON for each question
    return questions.map(question => {
        // MySQL JSON columns might return as object or string depending on driver/version
        if (question.options) {
            if (typeof question.options === 'string') {
                try {
                    question.options = JSON.parse(question.options);
                } catch (e) {
                    console.error('[DB] Error parsing options JSON for question', question.id, ':', e, 'Raw value:', question.options);
                    question.options = [];
                }
            } else if (Array.isArray(question.options)) {
                // Already parsed by MySQL driver
                question.options = question.options;
            } else {
                console.warn('[DB] Options is not string or array for question', question.id, ':', typeof question.options, question.options);
                question.options = [];
            }
        } else {
            question.options = [];
        }

        // Parse correct_answer_indices JSON for multiple-choice questions
        if (question.questionType === 'multiple' && question.correctAnswerIndices) {
            if (typeof question.correctAnswerIndices === 'string') {
                try {
                    question.correctAnswerIndices = JSON.parse(question.correctAnswerIndices);
                } catch (e) {
                    console.error('[DB] Error parsing correctAnswerIndices JSON for question', question.id, ':', e);
                    question.correctAnswerIndices = [];
                }
            } else if (Array.isArray(question.correctAnswerIndices)) {
                // Already parsed
                question.correctAnswerIndices = question.correctAnswerIndices;
            }
        } else if (question.questionType === 'multiple') {
            question.correctAnswerIndices = [];
        }

        // Set default question type if not set (for backward compatibility)
        if (!question.questionType) {
            question.questionType = 'single';
        }

        return question;
    });
}

/**
 * Update quiz question
 * @param {string} questionId - Question ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated question
 */
async function updateQuizQuestion(questionId, updates) {
    const fields = [];
    const values = [];

    if (updates.questionText !== undefined) {
        fields.push('question_text = ?');
        values.push(updates.questionText);
    }
    if (updates.options !== undefined) {
        fields.push('options = ?');
        values.push(JSON.stringify(updates.options));
    }
    if (updates.questionType !== undefined) {
        fields.push('question_type = ?');
        values.push(updates.questionType);
    }
    if (updates.correctAnswerIndex !== undefined) {
        fields.push('correct_answer_index = ?');
        values.push(updates.correctAnswerIndex);
        // If switching to single, clear multiple indices
        if (updates.questionType === 'single' || (!updates.questionType && updates.correctAnswerIndex !== null)) {
            fields.push('correct_answer_indices = NULL');
        }
    }
    if (updates.correctAnswerIndices !== undefined) {
        if (updates.correctAnswerIndices === null) {
            fields.push('correct_answer_indices = NULL');
        } else {
            fields.push('correct_answer_indices = ?');
            values.push(JSON.stringify(updates.correctAnswerIndices));
        }
        // If switching to multiple, clear single index
        if (updates.questionType === 'multiple') {
            fields.push('correct_answer_index = NULL');
        }
    }
    if (updates.explanation !== undefined) {
        fields.push('explanation = ?');
        values.push(updates.explanation);
    }
    if (updates.orderIndex !== undefined) {
        fields.push('order_index = ?');
        values.push(updates.orderIndex);
    }

    if (fields.length === 0) {
        return await getQuizQuestionById(questionId);
    }

    values.push(questionId);
    await db.query(
        `UPDATE quiz_questions SET ${fields.join(', ')} WHERE id = ?`,
        values
    );

    return await getQuizQuestionById(questionId);
}

/**
 * Delete quiz question
 * @param {string} questionId - Question ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteQuizQuestion(questionId) {
    const result = await db.query(
        `DELETE FROM quiz_questions WHERE id = ?`,
        [questionId]
    );
    return result.affectedRows > 0;
}

/**
 * Create a quiz attempt
 * @param {Object} attemptData - Attempt data object
 * @returns {Promise<Object>} Created attempt
 */
async function createQuizAttempt(attemptData) {
    const {
        id,
        userId,
        chapterId,
        score,
        totalQuestions,
        percentage,
        answers
    } = attemptData;

    await db.query(
        `INSERT INTO quiz_attempts (
            id, user_id, chapter_id, score, total_questions,
            percentage, answers
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            userId,
            chapterId,
            score,
            totalQuestions,
            percentage,
            JSON.stringify(answers)
        ]
    );

    return await getQuizAttemptById(id);
}

/**
 * Get quiz attempt by ID
 * @param {string} attemptId - Attempt ID
 * @returns {Promise<Object|null>} Attempt object or null
 */
async function getQuizAttemptById(attemptId) {
    const attempts = await db.query(
        `SELECT 
            id,
            user_id as userId,
            chapter_id as chapterId,
            score,
            total_questions as totalQuestions,
            percentage,
            answers,
            completed_at as completedAt
         FROM quiz_attempts 
         WHERE id = ?`,
        [attemptId]
    );

    if (attempts.length === 0) {
        return null;
    }

    const attempt = attempts[0];
    // Parse answers JSON
    if (attempt.answers) {
        try {
            attempt.answers = JSON.parse(attempt.answers);
        } catch (e) {
            attempt.answers = [];
        }
    } else {
        attempt.answers = [];
    }

    return attempt;
}

/**
 * Get quiz attempts by user and chapter
 * @param {number} userId - User ID
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Array>} Array of attempts
 */
async function getQuizAttemptsByUserAndChapter(userId, chapterId) {
    const attempts = await db.query(
        `SELECT 
            id,
            user_id as userId,
            chapter_id as chapterId,
            score,
            total_questions as totalQuestions,
            percentage,
            answers,
            completed_at as completedAt
         FROM quiz_attempts 
         WHERE user_id = ? AND chapter_id = ?
         ORDER BY completed_at DESC`,
        [userId, chapterId]
    );

    // Parse answers JSON for each attempt
    return attempts.map(attempt => {
        if (attempt.answers) {
            try {
                attempt.answers = JSON.parse(attempt.answers);
            } catch (e) {
                attempt.answers = [];
            }
        } else {
            attempt.answers = [];
        }
        return attempt;
    });
}

/**
 * Get best quiz attempt for user and chapter
 * @param {number} userId - User ID
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Object|null>} Best attempt or null
 */
async function getBestQuizAttempt(userId, chapterId) {
    const attempts = await db.query(
        `SELECT 
            id,
            user_id as userId,
            chapter_id as chapterId,
            score,
            total_questions as totalQuestions,
            percentage,
            answers,
            completed_at as completedAt
         FROM quiz_attempts 
         WHERE user_id = ? AND chapter_id = ?
         ORDER BY percentage DESC, completed_at DESC
         LIMIT 1`,
        [userId, chapterId]
    );

    if (attempts.length === 0) {
        return null;
    }

    const attempt = attempts[0];
    // Parse answers JSON
    if (attempt.answers) {
        try {
            attempt.answers = JSON.parse(attempt.answers);
        } catch (e) {
            attempt.answers = [];
        }
    } else {
        attempt.answers = [];
    }

    return attempt;
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
    getChapterTextById,

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
    deleteExercise,

    // Final Project operations
    createFinalProject,
    getFinalProjectById,
    getFinalProjectByCourseId,
    updateFinalProject,
    deleteFinalProject,
    createFinalProjectDocument,
    getFinalProjectDocumentById,
    getFinalProjectDocuments,
    updateFinalProjectDocument,
    deleteFinalProjectDocument,
    createFinalProjectSubmission,
    getFinalProjectSubmissionById,
    getFinalProjectSubmissionByUser,
    updateFinalProjectSubmission,
    deleteFinalProjectSubmission,

    // Quiz operations
    createQuizQuestion,
    getQuizQuestionById,
    getQuizQuestionsByChapterId,
    updateQuizQuestion,
    deleteQuizQuestion,
    createQuizAttempt,
    getQuizAttemptById,
    getQuizAttemptsByUserAndChapter,
    getBestQuizAttempt
};

