const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const validation = require('../middleware/validation');

// GET /api/courses - Get list of all courses
router.get('/', courseController.getAllCourses);

// POST /api/courses - Create a new course
router.post('/', courseController.createCourse);

// GET /api/courses/:courseId - Get a course by ID
router.get('/:courseId', validation.validateDocId, courseController.getCourse);

// PUT /api/courses/:courseId - Update a course
router.put('/:courseId', validation.validateDocId, courseController.updateCourse);

// DELETE /api/courses/:courseId - Delete a course
router.delete('/:courseId', validation.validateDocId, courseController.deleteCourse);

module.exports = router;

