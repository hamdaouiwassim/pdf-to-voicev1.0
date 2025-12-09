const subscriptionUtils = require('../utils/subscriptionUtils');

/**
 * Get all subscriptions
 * GET /api/subscriptions
 */
async function getAllSubscriptions(req, res) {
    try {
        const subscriptions = await subscriptionUtils.getAllSubscriptions();
        res.json(subscriptions);
    } catch (error) {
        console.error("[Subscriptions List Error]:", error);
        res.status(500).json({
            error: 'Failed to list subscriptions.',
            details: error.message
        });
    }
}

/**
 * Get subscription by ID
 * GET /api/subscriptions/:subscriptionId
 */
async function getSubscriptionById(req, res) {
    try {
        const { subscriptionId } = req.params;
        const subscription = await subscriptionUtils.getSubscriptionById(subscriptionId);

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        res.json(subscription);
    } catch (error) {
        console.error("[Subscription Get Error]:", error);
        res.status(500).json({
            error: 'Failed to get subscription.',
            details: error.message
        });
    }
}

/**
 * Create a new subscription
 * POST /api/subscriptions
 */
async function createSubscription(req, res) {
    try {
        const { name, description, price, durationDays, isActive, features } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Subscription name is required' });
        }

        if (!durationDays || durationDays < 1) {
            return res.status(400).json({ error: 'Duration days must be at least 1' });
        }

        const subscription = await subscriptionUtils.createSubscription({
            name,
            description,
            price: price || 0.00,
            durationDays: durationDays || 30,
            isActive: isActive !== undefined ? isActive : true,
            features
        });

        res.status(201).json(subscription);
    } catch (error) {
        console.error("[Subscription Create Error]:", error);
        res.status(500).json({
            error: 'Failed to create subscription.',
            details: error.message
        });
    }
}

/**
 * Update subscription
 * PUT /api/subscriptions/:subscriptionId
 */
async function updateSubscription(req, res) {
    try {
        const { subscriptionId } = req.params;
        const { name, description, price, durationDays, isActive, features } = req.body;

        const existingSubscription = await subscriptionUtils.getSubscriptionById(subscriptionId);
        if (!existingSubscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (price !== undefined) updates.price = price;
        if (durationDays !== undefined) {
            if (durationDays < 1) {
                return res.status(400).json({ error: 'Duration days must be at least 1' });
            }
            updates.durationDays = durationDays;
        }
        if (isActive !== undefined) updates.isActive = isActive;
        if (features !== undefined) updates.features = features;

        const subscription = await subscriptionUtils.updateSubscription(subscriptionId, updates);
        res.json(subscription);
    } catch (error) {
        console.error("[Subscription Update Error]:", error);
        res.status(500).json({
            error: 'Failed to update subscription.',
            details: error.message
        });
    }
}

/**
 * Delete subscription
 * DELETE /api/subscriptions/:subscriptionId
 */
async function deleteSubscription(req, res) {
    try {
        const { subscriptionId } = req.params;

        const existingSubscription = await subscriptionUtils.getSubscriptionById(subscriptionId);
        if (!existingSubscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        await subscriptionUtils.deleteSubscription(subscriptionId);
        res.json({
            message: 'Subscription deleted successfully',
            subscriptionId
        });
    } catch (error) {
        console.error("[Subscription Delete Error]:", error);
        res.status(500).json({
            error: 'Failed to delete subscription.',
            details: error.message
        });
    }
}

/**
 * Get user's active subscription
 * GET /api/subscriptions/user/active
 */
async function getUserActiveSubscription(req, res) {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const subscription = await subscriptionUtils.getUserActiveSubscription(userId);
        res.json(subscription);
    } catch (error) {
        console.error("[User Subscription Get Error]:", error);
        res.status(500).json({
            error: 'Failed to get user subscription.',
            details: error.message
        });
    }
}

/**
 * Get all user subscriptions (history)
 * GET /api/subscriptions/user/all
 */
async function getUserSubscriptions(req, res) {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const subscriptions = await subscriptionUtils.getUserSubscriptions(userId);
        res.json(subscriptions);
    } catch (error) {
        console.error("[User Subscriptions Get Error]:", error);
        res.status(500).json({
            error: 'Failed to get user subscriptions.',
            details: error.message
        });
    }
}

/**
 * Assign subscription to user (admin only)
 * POST /api/subscriptions/:subscriptionId/assign
 */
async function assignSubscriptionToUser(req, res) {
    try {
        const { subscriptionId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const userSubscription = await subscriptionUtils.assignSubscriptionToUser(userId, subscriptionId);
        res.status(201).json(userSubscription);
    } catch (error) {
        console.error("[Assign Subscription Error]:", error);
        res.status(500).json({
            error: 'Failed to assign subscription.',
            details: error.message
        });
    }
}

/**
 * Cancel user subscription
 * POST /api/subscriptions/user/:userSubscriptionId/cancel
 */
async function cancelUserSubscription(req, res) {
    try {
        const { userSubscriptionId } = req.params;
        await subscriptionUtils.cancelUserSubscription(userSubscriptionId);
        res.json({
            message: 'Subscription cancelled successfully',
            userSubscriptionId
        });
    } catch (error) {
        console.error("[Cancel Subscription Error]:", error);
        res.status(500).json({
            error: 'Failed to cancel subscription.',
            details: error.message
        });
    }
}

/**
 * Link subscription to courses
 * PUT /api/subscriptions/:subscriptionId/courses
 */
async function linkSubscriptionToCourses(req, res) {
    try {
        const { subscriptionId } = req.params;
        const { courseIds } = req.body;

        if (!Array.isArray(courseIds)) {
            return res.status(400).json({ error: 'courseIds must be an array' });
        }

        const subscription = await subscriptionUtils.getSubscriptionById(subscriptionId);
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        await subscriptionUtils.linkSubscriptionToCourses(subscriptionId, courseIds);
        res.json({ message: 'Subscription linked to courses successfully', courseIds });
    } catch (error) {
        console.error("[Link Subscription to Courses Error]:", error);
        res.status(500).json({
            error: 'Failed to link subscription to courses.',
            details: error.message
        });
    }
}

/**
 * Get courses for a subscription
 * GET /api/subscriptions/:subscriptionId/courses
 */
async function getCoursesForSubscription(req, res) {
    try {
        const { subscriptionId } = req.params;
        const courses = await subscriptionUtils.getCoursesForSubscription(subscriptionId);
        res.json(courses);
    } catch (error) {
        console.error("[Get Courses for Subscription Error]:", error);
        res.status(500).json({
            error: 'Failed to get courses for subscription.',
            details: error.message
        });
    }
}

/**
 * Get subscriptions for a course
 * GET /api/courses/:courseId/subscriptions
 */
async function getSubscriptionsForCourse(req, res) {
    try {
        const { courseId } = req.params;
        const subscriptions = await subscriptionUtils.getSubscriptionsForCourse(courseId);
        res.json(subscriptions);
    } catch (error) {
        console.error("[Get Subscriptions for Course Error]:", error);
        res.status(500).json({
            error: 'Failed to get subscriptions for course.',
            details: error.message
        });
    }
}

/**
 * Enroll user in course
 * POST /api/courses/:courseId/enroll
 */
async function enrollInCourse(req, res) {
    try {
        const { courseId } = req.params;
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await subscriptionUtils.enrollUserInCourse(userId, courseId);
        res.json({
            message: result.updated ? 'Enrollment updated successfully' : 'Enrolled in course successfully',
            courseId,
            ...result
        });
    } catch (error) {
        console.error("[Enroll in Course Error]:", error);
        res.status(403).json({
            error: 'Failed to enroll in course.',
            details: error.message
        });
    }
}

/**
 * Admin: Enroll user in course (bypasses subscription requirement)
 * POST /api/users/:userId/enroll/:courseId
 */
async function adminEnrollUserInCourse(req, res) {
    try {
        const { userId, courseId } = req.params;
        
        // Only admins can use this endpoint
        if (req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await subscriptionUtils.enrollUserInCourseDirectly(userId, courseId);
        res.json({
            message: result.updated ? 'Enrollment updated successfully' : 'User enrolled in course successfully',
            userId: parseInt(userId),
            courseId,
            ...result
        });
    } catch (error) {
        console.error("[Admin Enroll User Error]:", error);
        res.status(500).json({
            error: 'Failed to enroll user in course.',
            details: error.message
        });
    }
}

/**
 * Get user's enrolled courses
 * GET /api/users/me/courses
 */
async function getUserEnrolledCourses(req, res) {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const courses = await subscriptionUtils.getUserEnrolledCourses(userId);
        res.json(courses);
    } catch (error) {
        console.error("[Get User Enrolled Courses Error]:", error);
        res.status(500).json({
            error: 'Failed to get enrolled courses.',
            details: error.message
        });
    }
}

module.exports = {
    getAllSubscriptions,
    getSubscriptionById,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    getUserActiveSubscription,
    getUserSubscriptions,
    assignSubscriptionToUser,
    cancelUserSubscription,
    linkSubscriptionToCourses,
    getCoursesForSubscription,
    getSubscriptionsForCourse,
    enrollInCourse,
    getUserEnrolledCourses,
    adminEnrollUserInCourse,
    cancelUserEnrollment
};

/**
 * Admin: Cancel user enrollment in course
 * DELETE /api/users/:userId/enroll/:courseId
 */
async function cancelUserEnrollment(req, res) {
    try {
        const { userId, courseId } = req.params;
        
        // Only admins can use this endpoint
        if (req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await subscriptionUtils.cancelUserEnrollment(userId, courseId);
        
        if (!result) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        res.json({
            message: 'User unenrolled from course successfully',
            userId: parseInt(userId),
            courseId
        });
    } catch (error) {
        console.error("[Cancel Enrollment Error]:", error);
        res.status(500).json({
            error: 'Failed to cancel enrollment.',
            details: error.message
        });
    }
}

module.exports = {
    getAllSubscriptions,
    getSubscriptionById,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    linkSubscriptionToCourses,
    getCoursesForSubscription,
    getSubscriptionsForCourse,
    assignSubscriptionToUser,
    getUserActiveSubscription,
    getUserSubscriptions,
    cancelUserSubscription,
    enrollInCourse,
    getUserEnrolledCourses,
    adminEnrollUserInCourse,
    cancelUserEnrollment
};

