const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const dbUtils = require('../utils/dbUtils');
const fileUtils = require('../utils/fileUtils');

/**
 * Create a new final project
 * POST /api/courses/:courseId/final-project
 */
async function createFinalProject(req, res) {
    try {
        const { courseId } = req.params;
        const { projectName, projectDescription } = req.body;

        if (!projectName || !projectName.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        if (projectName.length > 255) {
            return res.status(400).json({ error: 'Project name must be less than 255 characters' });
        }

        // Verify course exists
        const course = await dbUtils.getCourseById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Check if final project already exists for this course
        const existingProject = await dbUtils.getFinalProjectByCourseId(courseId);
        if (existingProject) {
            return res.status(400).json({ error: 'Un projet final existe déjà pour ce cours. Un seul projet final est autorisé par cours.' });
        }

        // Generate unique ID
        const projectId = crypto.randomUUID();

        // Create final project
        const project = await dbUtils.createFinalProject({
            id: projectId,
            courseId,
            projectName: projectName.trim(),
            projectDescription: projectDescription?.trim() || null
        });

        res.status(201).json({
            id: project.id,
            projectName: project.projectName,
            projectDescription: project.projectDescription,
            courseId: project.courseId,
            message: 'Final project created successfully'
        });
    } catch (error) {
        console.error('[Final Project] Error creating final project:', error);
        res.status(500).json({ error: 'Failed to create final project', details: error.message });
    }
}

/**
 * Get final project by course ID
 * GET /api/courses/:courseId/final-project
 */
async function getFinalProjectByCourse(req, res) {
    try {
        const { courseId } = req.params;

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found for this course' });
        }

        // Get documents
        const documents = await dbUtils.getFinalProjectDocuments(project.id);

        res.json({
            ...project,
            documents
        });
    } catch (error) {
        console.error('[Final Project] Error getting final project:', error);
        res.status(500).json({ error: 'Failed to get final project', details: error.message });
    }
}

/**
 * Update final project
 * PUT /api/courses/:courseId/final-project
 */
async function updateFinalProject(req, res) {
    try {
        const { courseId } = req.params;
        const { projectName, projectDescription } = req.body;

        const existingProject = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!existingProject) {
            return res.status(404).json({ error: 'Final project not found' });
        }

        const updates = {};
        if (projectName !== undefined) {
            if (!projectName.trim()) {
                return res.status(400).json({ error: 'Project name cannot be empty' });
            }
            if (projectName.length > 255) {
                return res.status(400).json({ error: 'Project name must be less than 255 characters' });
            }
            updates.projectName = projectName.trim();
        }
        if (projectDescription !== undefined) {
            updates.projectDescription = projectDescription?.trim() || null;
        }

        const updatedProject = await dbUtils.updateFinalProject(existingProject.id, updates);

        res.json({
            id: updatedProject.id,
            projectName: updatedProject.projectName,
            projectDescription: updatedProject.projectDescription,
            courseId: updatedProject.courseId,
            message: 'Final project updated successfully'
        });
    } catch (error) {
        console.error('[Final Project] Error updating final project:', error);
        res.status(500).json({ error: 'Failed to update final project', details: error.message });
    }
}

/**
 * Delete final project
 * DELETE /api/courses/:courseId/final-project
 */
async function deleteFinalProject(req, res) {
    try {
        const { courseId } = req.params;

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found' });
        }

        // Delete all documents first
        const documents = await dbUtils.getFinalProjectDocuments(project.id);
        for (const doc of documents) {
            if (doc.pdfResource) {
                const pdfPath = path.join(fileUtils.getFinalProjectDir(courseId, project.id), doc.pdfResource);
                try {
                    await fs.unlink(pdfPath);
                } catch (err) {
                    console.warn('[Final Project] Could not delete PDF file:', err.message);
                }
            }
        }

        const deleted = await dbUtils.deleteFinalProject(project.id);
        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete final project' });
        }

        res.json({ message: 'Final project deleted successfully' });
    } catch (error) {
        console.error('[Final Project] Error deleting final project:', error);
        res.status(500).json({ error: 'Failed to delete final project', details: error.message });
    }
}

/**
 * Add document to final project
 * POST /api/courses/:courseId/final-project/documents
 */
async function addDocument(req, res) {
    try {
        const { courseId } = req.params;
        const { documentName, documentDescription } = req.body;
        const pdfFile = req.files?.pdfResource;

        if (!documentName || !documentName.trim()) {
            return res.status(400).json({ error: 'Document name is required' });
        }

        if (documentName.length > 255) {
            return res.status(400).json({ error: 'Document name must be less than 255 characters' });
        }

        if (!pdfFile) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        // Validate PDF file
        if (pdfFile.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'PDF resource must be a PDF file' });
        }

        if (pdfFile.size > 50 * 1024 * 1024) { // 50MB limit
            return res.status(400).json({ error: 'PDF resource must be less than 50MB' });
        }

        // Get final project
        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found for this course' });
        }

        // Create directory structure: media/{courseId}/uploads/final-projects/{projectId}/
        const projectDir = fileUtils.getFinalProjectDir(courseId, project.id);
        await fs.mkdir(projectDir, { recursive: true });

        // Save PDF file
        const ext = path.extname(pdfFile.name) || '.pdf';
        const documentId = crypto.randomUUID();
        const pdfResource = `document_${documentId}${ext}`;
        const pdfPath = path.join(projectDir, pdfResource);

        await pdfFile.mv(pdfPath);

        // Create document in database
        const document = await dbUtils.createFinalProjectDocument({
            id: documentId,
            finalProjectId: project.id,
            documentName: documentName.trim(),
            documentDescription: documentDescription?.trim() || null,
            pdfResource
        });

        res.status(201).json({
            id: document.id,
            documentName: document.documentName,
            documentDescription: document.documentDescription,
            pdfResource: document.pdfResource,
            finalProjectId: document.finalProjectId,
            message: 'Document added successfully'
        });
    } catch (error) {
        console.error('[Final Project] Error adding document:', error);
        res.status(500).json({ error: 'Failed to add document', details: error.message });
    }
}

/**
 * Get final project document PDF
 * GET /api/courses/:courseId/final-project/documents/:documentId/pdf
 */
async function getDocumentPdf(req, res) {
    try {
        const { courseId, documentId } = req.params;

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found' });
        }

        const document = await dbUtils.getFinalProjectDocumentById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (document.finalProjectId !== project.id) {
            return res.status(400).json({ error: 'Document does not belong to this final project' });
        }

        if (!document.pdfResource) {
            return res.status(404).json({ error: 'PDF resource not found for this document' });
        }

        const pdfPath = path.join(fileUtils.getFinalProjectDir(courseId, project.id), document.pdfResource);

        // Check if file exists
        try {
            await fs.access(pdfPath);
        } catch {
            return res.status(404).json({ error: 'PDF file not found' });
        }

        res.sendFile(path.resolve(pdfPath));
    } catch (error) {
        console.error('[Final Project] Error getting document PDF:', error);
        res.status(500).json({ error: 'Failed to get PDF', details: error.message });
    }
}

/**
 * Delete document from final project
 * DELETE /api/courses/:courseId/final-project/documents/:documentId
 */
async function deleteDocument(req, res) {
    try {
        const { courseId, documentId } = req.params;

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found' });
        }

        const document = await dbUtils.getFinalProjectDocumentById(documentId);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (document.finalProjectId !== project.id) {
            return res.status(400).json({ error: 'Document does not belong to this final project' });
        }

        // Delete PDF file if exists
        if (document.pdfResource) {
            const pdfPath = path.join(fileUtils.getFinalProjectDir(courseId, project.id), document.pdfResource);
            try {
                await fs.unlink(pdfPath);
            } catch (err) {
                console.warn('[Final Project] Could not delete PDF file:', err.message);
            }
        }

        const deleted = await dbUtils.deleteFinalProjectDocument(documentId);
        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete document' });
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('[Final Project] Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document', details: error.message });
    }
}

/**
 * Get user's submission for final project
 * GET /api/courses/:courseId/final-project/submission
 */
async function getSubmission(req, res) {
    try {
        const { courseId } = req.params;
        const userEmail = req.session?.email;

        if (!userEmail) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found for this course' });
        }

        const submission = await dbUtils.getFinalProjectSubmissionByUser(project.id, userEmail);
        if (!submission) {
            return res.status(404).json({ error: 'No submission found' });
        }

        res.json(submission);
    } catch (error) {
        console.error('[Final Project] Error getting submission:', error);
        res.status(500).json({ error: 'Failed to get submission', details: error.message });
    }
}

/**
 * Create or update user's submission for final project
 * POST /api/courses/:courseId/final-project/submission
 * PUT /api/courses/:courseId/final-project/submission
 */
async function submitWork(req, res) {
    try {
        const { courseId } = req.params;
        const { comment } = req.body;
        const file = req.files?.file;
        const userEmail = req.session?.email;

        if (!userEmail) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found for this course' });
        }

        // Check if submission already exists
        const existingSubmission = await dbUtils.getFinalProjectSubmissionByUser(project.id, userEmail);
        const isUpdate = !!existingSubmission;

        // Validate file if provided
        if (file) {
            const validTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed'];
            const validExtensions = ['.pdf', '.zip'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

            if (!validTypes.includes(file.mimetype) && !validExtensions.includes(fileExtension)) {
                return res.status(400).json({ error: 'File must be PDF or ZIP' });
            }

            if (file.size > 50 * 1024 * 1024) {
                return res.status(400).json({ error: 'File size must be less than 50MB' });
            }
        } else if (!isUpdate) {
            return res.status(400).json({ error: 'File is required for new submission' });
        }

        // Create directory structure: media/{courseId}/uploads/final-projects/{projectId}/submissions/
        const submissionsDir = path.join(fileUtils.getFinalProjectDir(courseId, project.id), 'submissions');
        await fs.mkdir(submissionsDir, { recursive: true });

        let fileResource = existingSubmission?.fileResource;

        // Save file if provided
        if (file) {
            const ext = path.extname(file.name) || (file.mimetype === 'application/pdf' ? '.pdf' : '.zip');
            const submissionId = existingSubmission?.id || crypto.randomUUID();
            fileResource = `submission_${submissionId}${ext}`;
            const filePath = path.join(submissionsDir, fileResource);

            // Delete old file if updating
            if (existingSubmission?.fileResource && existingSubmission.fileResource !== fileResource) {
                const oldFilePath = path.join(submissionsDir, existingSubmission.fileResource);
                try {
                    await fs.unlink(oldFilePath);
                } catch (err) {
                    console.warn('[Final Project] Could not delete old file:', err.message);
                }
            }

            await file.mv(filePath);
        }

        if (isUpdate) {
            // Update existing submission
            const updates = {};
            if (fileResource) updates.fileResource = fileResource;
            if (comment !== undefined) updates.comment = comment?.trim() || null;

            const updatedSubmission = await dbUtils.updateFinalProjectSubmission(existingSubmission.id, updates);

            res.json({
                ...updatedSubmission,
                message: 'Submission updated successfully'
            });
        } else {
            // Create new submission
            const submissionId = crypto.randomUUID();
            const submission = await dbUtils.createFinalProjectSubmission({
                id: submissionId,
                finalProjectId: project.id,
                userEmail,
                fileResource,
                comment: comment?.trim() || null
            });

            res.status(201).json({
                ...submission,
                message: 'Submission created successfully'
            });
        }
    } catch (error) {
        console.error('[Final Project] Error submitting work:', error);
        res.status(500).json({ error: 'Failed to submit work', details: error.message });
    }
}

/**
 * Get submission file
 * GET /api/courses/:courseId/final-project/submission/file
 */
async function getSubmissionFile(req, res) {
    try {
        const { courseId } = req.params;
        const userEmail = req.session?.email;

        if (!userEmail) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const project = await dbUtils.getFinalProjectByCourseId(courseId);
        if (!project) {
            return res.status(404).json({ error: 'Final project not found' });
        }

        const submission = await dbUtils.getFinalProjectSubmissionByUser(project.id, userEmail);
        if (!submission || !submission.fileResource) {
            return res.status(404).json({ error: 'Submission file not found' });
        }

        const filePath = path.join(fileUtils.getFinalProjectDir(courseId, project.id), 'submissions', submission.fileResource);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }

        res.sendFile(path.resolve(filePath));
    } catch (error) {
        console.error('[Final Project] Error getting submission file:', error);
        res.status(500).json({ error: 'Failed to get file', details: error.message });
    }
}

module.exports = {
    createFinalProject,
    getFinalProjectByCourse,
    updateFinalProject,
    deleteFinalProject,
    addDocument,
    getDocumentPdf,
    deleteDocument,
    getSubmission,
    submitWork,
    getSubmissionFile
};
