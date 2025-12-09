/**
 * Subscription Middleware
 * Checks if user has an active subscription and enrollment for course access
 */

const subscriptionUtils = require('../utils/subscriptionUtils');

/**
 * Require active subscription and enrollment to access courses
 */
async function requireSubscription(req, res, next) {
    try {
        // Admins bypass subscription check
        if (req.session && req.session.role === 'admin') {
            return next();
        }

        // Check if user is authenticated
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please login to access this resource'
            });
        }

        const userId = req.session.userId;
        // Safely read courseId from params/body/query (defensive against undefined containers)
        const courseId =
            (req.params && req.params.courseId) ||
            (req.body && req.body.courseId) ||
            (req.query && req.query.courseId);

        // If accessing a specific course, check enrollment
        if (courseId) {
            try {
                const canAccess = await subscriptionUtils.canUserAccessCourse(userId, courseId);
                
                if (!canAccess) {
                    // Check if user has a subscription that includes this course
                    const subscriptions = await subscriptionUtils.getSubscriptionsForCourse(courseId);
                    const hasActiveSubscription = await subscriptionUtils.hasActiveSubscription(userId);
                    
                    if (hasActiveSubscription && subscriptions.length > 0) {
                        // User has subscription but not enrolled - try to auto-enroll
                        try {
                            await subscriptionUtils.enrollUserInCourse(userId, courseId);
                            return next();
                        } catch (enrollError) {
                            return res.status(403).json({
                                error: 'Enrollment required',
                                message: 'You need to enroll in this course. Your subscription may not include this course.',
                                requiresEnrollment: true,
                                courseId: courseId
                            });
                        }
                    } else {
                        return res.status(403).json({
                            error: 'Subscription and enrollment required',
                            message: 'You need an active subscription that includes this course and must be enrolled.',
                            requiresSubscription: true,
                            courseId: courseId
                        });
                    }
                }
            } catch (accessError) {
                console.error('[Subscription Middleware] Error checking course access:', accessError);
                // If there's an error checking access, allow it to fall through to the general error handler
                throw accessError;
            }
        } else {
            // General course list access (GET /api/courses) - allow all authenticated users to view the list
            // They can see all courses but can only access specific courses if enrolled/have subscription
            // No subscription check needed for listing courses
            // The subscription check will happen when they try to access a specific course
        }

        // User has access, proceed
        next();
    } catch (error) {
        console.error('[Subscription Middleware Error]:', error);
        res.status(500).json({
            error: 'Failed to check subscription',
            details: error.message
        });
    }
}

module.exports = {
    requireSubscription
};
