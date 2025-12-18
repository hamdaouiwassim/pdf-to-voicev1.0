const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const dbUtils = require('../utils/dbUtils');
const config = require('../config/config');

/**
 * Create a new lab
 * POST /api/labs
 */
async function createLab(req, res) {
    try {
        const { courseId, labName, labDescription, labType } = req.body;

        if (!courseId) {
            return res.status(400).json({ error: 'Course ID is required' });
        }

        if (!labName || !labName.trim()) {
            return res.status(400).json({ error: 'Lab name is required' });
        }

        if (!labType || !labType.trim()) {
            return res.status(400).json({ error: 'Lab type is required' });
        }

        if (labName.length > 255) {
            return res.status(400).json({ error: 'Lab name must be less than 255 characters' });
        }

        // Verify course exists
        const course = await dbUtils.getCourseById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Generate unique ID for the lab
        const labId = crypto.randomUUID();

        // Create lab
        const lab = await dbUtils.createLab({
            id: labId,
            courseId,
            labName: labName.trim(),
            labDescription: labDescription?.trim() || null,
            labType: labType.trim()
        });

        res.status(201).json({
            labId: lab.id,
            labName: lab.labName,
            labDescription: lab.labDescription,
            labType: lab.labType,
            courseId: lab.courseId,
            message: 'Lab created successfully'
        });
    } catch (error) {
        console.error('[Lab Management] Error creating lab:', error);
        res.status(500).json({ error: 'Failed to create lab', details: error.message });
    }
}

/**
 * Get all labs
 * GET /api/labs
 */
async function getAllLabs(req, res) {
    try {
        const labs = await dbUtils.getAllLabs();
        res.json(labs);
    } catch (error) {
        console.error('[Lab Management] Error getting labs:', error);
        res.status(500).json({ error: 'Failed to get labs', details: error.message });
    }
}

/**
 * Get labs by course ID
 * GET /api/courses/:courseId/labs
 */
async function getLabsByCourse(req, res) {
    try {
        const { courseId } = req.params;
        console.log('[Lab Management] getLabsByCourse called with courseId:', courseId);
        
        if (!courseId) {
            console.error('[Lab Management] No courseId provided in params');
            return res.status(400).json({ error: 'Course ID is required' });
        }
        
        const labs = await dbUtils.getLabsByCourseId(courseId);
        console.log(`[Lab Management] Found ${labs.length} labs for course ${courseId}`);
        res.json(labs);
    } catch (error) {
        console.error('[Lab Management] Error getting labs:', error);
        res.status(500).json({ error: 'Failed to get labs', details: error.message });
    }
}

/**
 * Get a lab by ID
 * GET /api/labs/:labId
 */
async function getLab(req, res) {
    try {
        const { labId } = req.params;
        const lab = await dbUtils.getLabById(labId);

        if (!lab) {
            return res.status(404).json({ error: 'Lab not found' });
        }

        res.json(lab);
    } catch (error) {
        console.error('[Lab Management] Error getting lab:', error);
        res.status(500).json({ error: 'Failed to get lab', details: error.message });
    }
}

/**
 * Update a lab
 * PUT /api/labs/:labId
 */
async function updateLab(req, res) {
    try {
        const { labId } = req.params;
        const { labName, labDescription, labType, courseId } = req.body;

        const existingLab = await dbUtils.getLabById(labId);
        if (!existingLab) {
            return res.status(404).json({ error: 'Lab not found' });
        }

        const updates = {};
        if (labName !== undefined) {
            if (!labName.trim()) {
                return res.status(400).json({ error: 'Lab name cannot be empty' });
            }
            if (labName.length > 255) {
                return res.status(400).json({ error: 'Lab name must be less than 255 characters' });
            }
            updates.labName = labName.trim();
        }
        if (labDescription !== undefined) {
            updates.labDescription = labDescription?.trim() || null;
        }
        if (labType !== undefined) {
            if (!labType.trim()) {
                return res.status(400).json({ error: 'Lab type cannot be empty' });
            }
            updates.labType = labType.trim();
        }
        if (courseId !== undefined) {
            // Verify course exists
            const course = await dbUtils.getCourseById(courseId);
            if (!course) {
                return res.status(404).json({ error: 'Course not found' });
            }
            updates.courseId = courseId;
        }

        const updatedLab = await dbUtils.updateLab(labId, updates);

        res.json({
            labId: updatedLab.id,
            labName: updatedLab.labName,
            labDescription: updatedLab.labDescription,
            labType: updatedLab.labType,
            courseId: updatedLab.courseId,
            message: 'Lab updated successfully'
        });
    } catch (error) {
        console.error('[Lab Management] Error updating lab:', error);
        res.status(500).json({ error: 'Failed to update lab', details: error.message });
    }
}

/**
 * Delete a lab
 * DELETE /api/labs/:labId
 */
async function deleteLab(req, res) {
    try {
        const { labId } = req.params;

        const lab = await dbUtils.getLabById(labId);
        if (!lab) {
            return res.status(404).json({ error: 'Lab not found' });
        }

        const deleted = await dbUtils.deleteLab(labId);
        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete lab' });
        }

        res.json({ message: 'Lab deleted successfully' });
    } catch (error) {
        console.error('[Lab Management] Error deleting lab:', error);
        res.status(500).json({ error: 'Failed to delete lab', details: error.message });
    }
}

/**
 * Create a new exercise
 * POST /api/labs/:labId/exercises
 */
async function createExercise(req, res) {
    try {
        const { labId } = req.params;
        const { exerciseName, exerciseDescription } = req.body;
        const pdfFile = req.files?.pdfResource;

        if (!exerciseName || !exerciseName.trim()) {
            return res.status(400).json({ error: 'Exercise name is required' });
        }

        if (exerciseName.length > 255) {
            return res.status(400).json({ error: 'Exercise name must be less than 255 characters' });
        }

        // Verify lab exists
        const lab = await dbUtils.getLabById(labId);
        if (!lab) {
            return res.status(404).json({ error: 'Lab not found' });
        }

        // Generate unique ID for the exercise
        const exerciseId = crypto.randomUUID();

        let pdfResource = null;

        // Handle PDF file upload if provided
        if (pdfFile) {
            // Validate PDF file
            if (pdfFile.mimetype !== 'application/pdf') {
                return res.status(400).json({ error: 'PDF resource must be a PDF file' });
            }

            if (pdfFile.size > 50 * 1024 * 1024) { // 50MB limit
                return res.status(400).json({ error: 'PDF resource must be less than 50MB' });
            }

            // Create lab directory structure: uploads/labs/{courseId}/{labId}/
            const labDir = path.join(config.UPLOADS_DIR, 'labs', lab.courseId, labId);
            await fs.mkdir(labDir, { recursive: true });

            // Save PDF file
            const ext = path.extname(pdfFile.name) || '.pdf';
            pdfResource = `exercise_${exerciseId}${ext}`;
            const pdfPath = path.join(labDir, pdfResource);

            await pdfFile.mv(pdfPath);
        }

        // Create exercise
        const exercise = await dbUtils.createExercise({
            id: exerciseId,
            labId,
            exerciseName: exerciseName.trim(),
            exerciseDescription: exerciseDescription?.trim() || null,
            pdfResource
        });

        res.status(201).json({
            exerciseId: exercise.id,
            exerciseName: exercise.exerciseName,
            exerciseDescription: exercise.exerciseDescription,
            pdfResource: exercise.pdfResource,
            labId: exercise.labId,
            message: 'Exercise created successfully'
        });
    } catch (error) {
        console.error('[Lab Management] Error creating exercise:', error);
        res.status(500).json({ error: 'Failed to create exercise', details: error.message });
    }
}

/**
 * Get exercises by lab ID
 * GET /api/labs/:labId/exercises
 */
async function getExercisesByLab(req, res) {
    try {
        const { labId } = req.params;
        const exercises = await dbUtils.getExercisesByLabId(labId);
        res.json(exercises);
    } catch (error) {
        console.error('[Lab Management] Error getting exercises:', error);
        res.status(500).json({ error: 'Failed to get exercises', details: error.message });
    }
}

/**
 * Get an exercise by ID
 * GET /api/exercises/:exerciseId
 */
async function getExercise(req, res) {
    try {
        const { exerciseId } = req.params;
        const exercise = await dbUtils.getExerciseById(exerciseId);

        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        res.json(exercise);
    } catch (error) {
        console.error('[Lab Management] Error getting exercise:', error);
        res.status(500).json({ error: 'Failed to get exercise', details: error.message });
    }
}

/**
 * Update an exercise
 * PUT /api/exercises/:exerciseId
 */
async function updateExercise(req, res) {
    try {
        const { exerciseId } = req.params;
        const { exerciseName, exerciseDescription } = req.body;
        const pdfFile = req.files?.pdfResource;

        const existingExercise = await dbUtils.getExerciseById(exerciseId);
        if (!existingExercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        const updates = {};
        if (exerciseName !== undefined) {
            if (!exerciseName.trim()) {
                return res.status(400).json({ error: 'Exercise name cannot be empty' });
            }
            if (exerciseName.length > 255) {
                return res.status(400).json({ error: 'Exercise name must be less than 255 characters' });
            }
            updates.exerciseName = exerciseName.trim();
        }
        if (exerciseDescription !== undefined) {
            updates.exerciseDescription = exerciseDescription?.trim() || null;
        }

        // Handle PDF file upload if provided
        if (pdfFile) {
            // Validate PDF file
            if (pdfFile.mimetype !== 'application/pdf') {
                return res.status(400).json({ error: 'PDF resource must be a PDF file' });
            }

            if (pdfFile.size > 50 * 1024 * 1024) { // 50MB limit
                return res.status(400).json({ error: 'PDF resource must be less than 50MB' });
            }

            // Get lab info
            const lab = await dbUtils.getLabById(existingExercise.labId);
            if (!lab) {
                return res.status(404).json({ error: 'Lab not found' });
            }

            // Delete old PDF if exists
            if (existingExercise.pdfResource) {
                const oldPdfPath = path.join(config.UPLOADS_DIR, 'labs', lab.courseId, existingExercise.labId, existingExercise.pdfResource);
                try {
                    await fs.unlink(oldPdfPath);
                } catch (err) {
                    console.warn('[Lab Management] Could not delete old PDF:', err.message);
                }
            }

            // Create lab directory structure
            const labDir = path.join(config.UPLOADS_DIR, 'labs', lab.courseId, existingExercise.labId);
            await fs.mkdir(labDir, { recursive: true });

            // Save new PDF file
            const ext = path.extname(pdfFile.name) || '.pdf';
            const pdfResource = `exercise_${exerciseId}${ext}`;
            const pdfPath = path.join(labDir, pdfResource);

            await pdfFile.mv(pdfPath);
            updates.pdfResource = pdfResource;
        }

        const updatedExercise = await dbUtils.updateExercise(exerciseId, updates);

        res.json({
            exerciseId: updatedExercise.id,
            exerciseName: updatedExercise.exerciseName,
            exerciseDescription: updatedExercise.exerciseDescription,
            pdfResource: updatedExercise.pdfResource,
            labId: updatedExercise.labId,
            message: 'Exercise updated successfully'
        });
    } catch (error) {
        console.error('[Lab Management] Error updating exercise:', error);
        res.status(500).json({ error: 'Failed to update exercise', details: error.message });
    }
}

/**
 * Delete an exercise
 * DELETE /api/exercises/:exerciseId
 */
async function deleteExercise(req, res) {
    try {
        const { exerciseId } = req.params;

        const exercise = await dbUtils.getExerciseById(exerciseId);
        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        // Delete PDF file if exists
        if (exercise.pdfResource) {
            const lab = await dbUtils.getLabById(exercise.labId);
            if (lab) {
                const pdfPath = path.join(config.UPLOADS_DIR, 'labs', lab.courseId, exercise.labId, exercise.pdfResource);
                try {
                    await fs.unlink(pdfPath);
                } catch (err) {
                    console.warn('[Lab Management] Could not delete PDF file:', err.message);
                }
            }
        }

        const deleted = await dbUtils.deleteExercise(exerciseId);
        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete exercise' });
        }

        res.json({ message: 'Exercise deleted successfully' });
    } catch (error) {
        console.error('[Lab Management] Error deleting exercise:', error);
        res.status(500).json({ error: 'Failed to delete exercise', details: error.message });
    }
}

/**
 * Get exercise PDF file
 * GET /api/exercises/:exerciseId/pdf
 */
async function getExercisePdf(req, res) {
    try {
        const { exerciseId } = req.params;
        const exercise = await dbUtils.getExerciseById(exerciseId);

        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found' });
        }

        if (!exercise.pdfResource) {
            return res.status(404).json({ error: 'PDF resource not found for this exercise' });
        }

        const lab = await dbUtils.getLabById(exercise.labId);
        if (!lab) {
            return res.status(404).json({ error: 'Lab not found' });
        }

        const pdfPath = path.join(config.UPLOADS_DIR, 'labs', lab.courseId, exercise.labId, exercise.pdfResource);

        // Check if file exists
        try {
            await fs.access(pdfPath);
        } catch {
            return res.status(404).json({ error: 'PDF file not found' });
        }

        res.sendFile(path.resolve(pdfPath));
    } catch (error) {
        console.error('[Lab Management] Error getting exercise PDF:', error);
        res.status(500).json({ error: 'Failed to get PDF', details: error.message });
    }
}

module.exports = {
    createLab,
    getAllLabs,
    getLabsByCourse,
    getLab,
    updateLab,
    deleteLab,
    createExercise,
    getExercisesByLab,
    getExercise,
    updateExercise,
    deleteExercise,
    getExercisePdf
};

