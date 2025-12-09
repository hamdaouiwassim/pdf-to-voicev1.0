const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

// All user routes require authentication
router.use(requireAuth);

// GET /api/users - Get all users
router.get('/', userController.getAllUsers);

// GET /api/users/:userId - Get user by ID
router.get('/:userId', userController.getUserById);

// POST /api/users - Create new user
router.post('/', userController.createUser);

// PUT /api/users/:userId - Update user
router.put('/:userId', userController.updateUser);

// DELETE /api/users/:userId - Delete user
router.delete('/:userId', userController.deleteUser);

// GET /api/users/:userId/courses - Get user's enrolled courses (admin)
router.get('/:userId/courses', async (req, res) => {
    try {
        const { userId } = req.params;
        const subscriptionUtils = require('../utils/subscriptionUtils');
        const courses = await subscriptionUtils.getUserEnrolledCourses(userId);
        res.json(courses);
    } catch (error) {
        console.error("[Get User Courses Error]:", error);
        res.status(500).json({ error: 'Failed to get user courses', details: error.message });
    }
});

// GET /api/users/:userId/subscriptions - Get user's all subscriptions (admin)
router.get('/:userId/subscriptions', async (req, res) => {
    try {
        const { userId } = req.params;
        const subscriptionUtils = require('../utils/subscriptionUtils');
        const subscriptions = await subscriptionUtils.getUserSubscriptions(userId);
        res.json(subscriptions);
    } catch (error) {
        console.error("[Get User Subscriptions Error]:", error);
        res.status(500).json({ error: 'Failed to get user subscriptions', details: error.message });
    }
});

module.exports = router;

