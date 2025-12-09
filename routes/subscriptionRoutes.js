const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { requireAuth } = require('../middleware/auth');

// All subscription routes require authentication
router.use(requireAuth);

// Subscription management routes (admin)
router.get('/', subscriptionController.getAllSubscriptions);
router.get('/:subscriptionId', subscriptionController.getSubscriptionById);
router.post('/', subscriptionController.createSubscription);
router.put('/:subscriptionId', subscriptionController.updateSubscription);
router.delete('/:subscriptionId', subscriptionController.deleteSubscription);

// User subscription routes
router.get('/user/active', subscriptionController.getUserActiveSubscription);
router.get('/user/all', subscriptionController.getUserSubscriptions);

// Assign subscription to user (admin)
router.post('/:subscriptionId/assign', subscriptionController.assignSubscriptionToUser);

// Cancel subscription
router.post('/user/:userSubscriptionId/cancel', subscriptionController.cancelUserSubscription);

// Link subscription to courses
router.put('/:subscriptionId/courses', subscriptionController.linkSubscriptionToCourses);
router.get('/:subscriptionId/courses', subscriptionController.getCoursesForSubscription);

module.exports = router;

