/**
 * Centralized Routing System for Titan Academy API
 * This file organizes all API routes in a structured and maintainable way
 */

const express = require('express');
const router = express.Router();

// Middleware imports
const { requireAuth } = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');
const subscriptionController = require('../controllers/subscriptionController');

// Route imports
const authRoutes = require('./authRoutes');
const documentRoutes = require('./documentRoutes');
const ttsRoutes = require('./ttsRoutes');
const qaRoutes = require('./qaRoutes');
const audioRoutes = require('./audioRoutes');
const labRoutes = require('./labRoutes');
const courseRoutes = require('./courseRoutes');
const chapterRoutes = require('./chapterRoutes');
const userRoutes = require('./userRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const labManagementRoutes = require('./labManagementRoutes');
const exerciseRoutes = require('./exerciseRoutes');
const courseLabRoutes = require('./courseLabRoutes');
const finalProjectRoutes = require('./finalProjectRoutes');

/**
 * Public Routes (No authentication required)
 */
router.use('/auth', authRoutes);

/**
 * Public API Routes (No authentication required)
 */
router.use('/documents', documentRoutes);
router.use('/tts', ttsRoutes);
router.use('/qa', qaRoutes);
router.use('/audio', audioRoutes);
router.use('/lab', labRoutes);

/**
 * Protected Routes (Require authentication)
 */

// Subscription routes
router.use('/subscriptions', requireAuth, subscriptionRoutes);

// Course enrollment routes (before requireSubscription middleware)
router.post('/courses/:courseId/enroll', requireAuth, subscriptionController.enrollInCourse);
router.get('/courses/:courseId/subscriptions', requireAuth, subscriptionController.getSubscriptionsForCourse);
router.get('/users/me/courses', requireAuth, subscriptionController.getUserEnrolledCourses);

// Admin: Enroll user in course (bypasses subscription requirement)
router.post('/users/:userId/enroll/:courseId', requireAuth, subscriptionController.adminEnrollUserInCourse);

// Admin: Cancel user enrollment in course
router.delete('/users/:userId/enroll/:courseId', requireAuth, subscriptionController.cancelUserEnrollment);

// Course routes (require subscription and enrollment)
router.use('/courses', requireAuth, requireSubscription, courseRoutes);

// Chapter routes (nested under courses, require subscription and enrollment)
router.use('/courses/:courseId/chapters', requireAuth, requireSubscription, chapterRoutes);

// Lab management routes
router.use('/labs', requireAuth, labManagementRoutes);

// Course-specific labs route
router.get('/courses/:courseId/labs', requireAuth, (req, res, next) => {
    const labManagementController = require('../controllers/labManagementController');
    return labManagementController.getLabsByCourse(req, res, next);
});

// Final project routes (nested under courses)
router.use('/courses/:courseId/final-project', requireAuth, finalProjectRoutes);

// Exercise routes
router.use('/exercises', requireAuth, exerciseRoutes);

// User management routes
router.use('/users', requireAuth, userRoutes);

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    try {
        const packageJson = require('../package.json');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: packageJson.version || '1.0.0'
        });
    } catch (error) {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        });
    }
});

module.exports = router;
