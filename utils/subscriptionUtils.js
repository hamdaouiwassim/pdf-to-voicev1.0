/**
 * Subscription utility functions
 * Handles all database operations for subscriptions and user subscriptions
 */

const db = require('../config/database');

/**
 * Subscription Database Operations
 */

/**
 * Create a new subscription
 */
async function createSubscription(subscriptionData) {
    const { name, description, price, durationDays, isActive, features } = subscriptionData;
    
    try {
        await db.query(
            `INSERT INTO subscriptions (name, description, price, duration_days, is_active, features)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name,
                description || null,
                price || 0.00,
                durationDays || 30,
                isActive !== undefined ? isActive : true,
                features ? JSON.stringify(features) : null
            ]
        );
        
        const result = await db.query('SELECT LAST_INSERT_ID() as id');
        const subscriptionId = result[0].id;
        
        console.log(`[DB] Subscription created successfully: ${subscriptionId} - ${name}`);
        return await getSubscriptionById(subscriptionId);
    } catch (error) {
        console.error('[DB] Error creating subscription:', error);
        throw error;
    }
}

/**
 * Get all subscriptions
 */
async function getAllSubscriptions() {
    const subscriptions = await db.query(
        `SELECT 
            id,
            name,
            description,
            price,
            duration_days as durationDays,
            is_active as isActive,
            features,
            created_at as createdAt,
            updated_at as updatedAt
         FROM subscriptions
         ORDER BY price ASC, created_at DESC`
    );

    return subscriptions.map(sub => ({
        ...sub,
        features: sub.features ? (typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features) : null
    }));
}

/**
 * Get subscription by ID
 */
async function getSubscriptionById(subscriptionId) {
    const subscriptions = await db.query(
        `SELECT 
            id,
            name,
            description,
            price,
            duration_days as durationDays,
            is_active as isActive,
            features,
            created_at as createdAt,
            updated_at as updatedAt
         FROM subscriptions
         WHERE id = ?`,
        [subscriptionId]
    );

    if (subscriptions.length === 0) {
        return null;
    }

    const sub = subscriptions[0];
    return {
        ...sub,
        features: sub.features ? (typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features) : null
    };
}

/**
 * Update subscription
 */
async function updateSubscription(subscriptionId, updates) {
    const allowedFields = ['name', 'description', 'price', 'duration_days', 'is_active', 'features'];
    const updateFields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key === 'durationDays' ? 'duration_days' : 
                      key === 'isActive' ? 'is_active' : key;
        
        if (allowedFields.includes(dbKey)) {
            updateFields.push(`${dbKey} = ?`);
            if (dbKey === 'features' && value !== null) {
                values.push(JSON.stringify(value));
            } else {
                values.push(value);
            }
        }
    }

    if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
    }

    values.push(subscriptionId);

    await db.query(
        `UPDATE subscriptions SET ${updateFields.join(', ')} WHERE id = ?`,
        values
    );

    console.log(`[DB] Subscription updated successfully: ${subscriptionId}`);
    return await getSubscriptionById(subscriptionId);
}

/**
 * Delete subscription
 */
async function deleteSubscription(subscriptionId) {
    await db.query('DELETE FROM subscriptions WHERE id = ?', [subscriptionId]);
    console.log(`[DB] Subscription deleted successfully: ${subscriptionId}`);
    return true;
}

/**
 * User Subscription Database Operations
 */

/**
 * Assign subscription to user
 */
async function assignSubscriptionToUser(userId, subscriptionId) {
    try {
        // Get subscription details
        const subscription = await getSubscriptionById(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Check if user already has an active subscription for the same subscription plan
        const now = new Date();
        const existingSubscription = await db.query(
            `SELECT id, start_date, end_date, is_active
             FROM user_subscriptions
             WHERE user_id = ? 
               AND subscription_id = ?
               AND is_active = TRUE
               AND end_date > ?`,
            [userId, subscriptionId, now]
        );

        if (existingSubscription.length > 0) {
            const existing = existingSubscription[0];
            const endDate = new Date(existing.end_date);
            throw new Error(`User already has an active subscription to this plan. Current subscription expires on ${endDate.toLocaleDateString()}.`);
        }

        // Calculate end date
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + subscription.durationDays);

        // Deactivate any other existing active subscriptions for this user (different plans)
        await db.query(
            'UPDATE user_subscriptions SET is_active = FALSE WHERE user_id = ? AND is_active = TRUE AND subscription_id != ?',
            [userId, subscriptionId]
        );

        // Create new subscription
        await db.query(
            `INSERT INTO user_subscriptions (user_id, subscription_id, start_date, end_date, is_active)
             VALUES (?, ?, ?, ?, TRUE)`,
            [userId, subscriptionId, startDate, endDate]
        );

        const result = await db.query('SELECT LAST_INSERT_ID() as id');
        const userSubscriptionId = result[0].id;

        console.log(`[DB] Subscription assigned to user: ${userId} - Subscription: ${subscriptionId}`);
        return await getUserSubscriptionById(userSubscriptionId);
    } catch (error) {
        console.error('[DB] Error assigning subscription to user:', error);
        throw error;
    }
}

/**
 * Get user's active subscription
 */
async function getUserActiveSubscription(userId) {
    const now = new Date();
    const subscriptions = await db.query(
        `SELECT 
            us.id,
            us.user_id as userId,
            us.subscription_id as subscriptionId,
            us.start_date as startDate,
            us.end_date as endDate,
            us.is_active as isActive,
            us.created_at as createdAt,
            s.name as subscriptionName,
            s.description as subscriptionDescription,
            s.price,
            s.duration_days as durationDays,
            s.features
         FROM user_subscriptions us
         INNER JOIN subscriptions s ON us.subscription_id = s.id
         WHERE us.user_id = ? 
           AND us.is_active = TRUE
           AND us.end_date > ?
         ORDER BY us.end_date DESC
         LIMIT 1`,
        [userId, now]
    );

    if (subscriptions.length === 0) {
        return null;
    }

    const sub = subscriptions[0];
    return {
        id: sub.id,
        userId: sub.userId,
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.subscriptionName,
        subscriptionDescription: sub.subscriptionDescription,
        price: sub.price,
        durationDays: sub.durationDays,
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive,
        features: sub.features ? (typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features) : null,
        createdAt: sub.createdAt
    };
}

/**
 * Check if user has active subscription
 */
async function hasActiveSubscription(userId) {
    const subscription = await getUserActiveSubscription(userId);
    return subscription !== null;
}

/**
 * Get all user subscriptions (history)
 */
async function getUserSubscriptions(userId) {
    const subscriptions = await db.query(
        `SELECT 
            us.id,
            us.user_id as userId,
            us.subscription_id as subscriptionId,
            us.start_date as startDate,
            us.end_date as endDate,
            us.is_active as isActive,
            us.created_at as createdAt,
            s.name as subscriptionName,
            s.description as subscriptionDescription,
            s.price,
            s.duration_days as durationDays,
            s.features
         FROM user_subscriptions us
         INNER JOIN subscriptions s ON us.subscription_id = s.id
         WHERE us.user_id = ?
         ORDER BY us.created_at DESC`,
        [userId]
    );

    return subscriptions.map(sub => ({
        id: sub.id,
        userId: sub.userId,
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.subscriptionName,
        subscriptionDescription: sub.subscriptionDescription,
        price: sub.price,
        durationDays: sub.durationDays,
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive,
        features: sub.features ? (typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features) : null,
        createdAt: sub.createdAt
    }));
}

/**
 * Get user subscription by ID
 */
async function getUserSubscriptionById(userSubscriptionId) {
    const subscriptions = await db.query(
        `SELECT 
            us.id,
            us.user_id as userId,
            us.subscription_id as subscriptionId,
            us.start_date as startDate,
            us.end_date as endDate,
            us.is_active as isActive,
            us.created_at as createdAt,
            s.name as subscriptionName,
            s.description as subscriptionDescription,
            s.price,
            s.duration_days as durationDays,
            s.features
         FROM user_subscriptions us
         INNER JOIN subscriptions s ON us.subscription_id = s.id
         WHERE us.id = ?`,
        [userSubscriptionId]
    );

    if (subscriptions.length === 0) {
        return null;
    }

    const sub = subscriptions[0];
    return {
        id: sub.id,
        userId: sub.userId,
        subscriptionId: sub.subscriptionId,
        subscriptionName: sub.subscriptionName,
        subscriptionDescription: sub.subscriptionDescription,
        price: sub.price,
        durationDays: sub.durationDays,
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive,
        features: sub.features ? (typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features) : null,
        createdAt: sub.createdAt
    };
}

/**
 * Cancel user subscription (deactivate)
 */
async function cancelUserSubscription(userSubscriptionId) {
    await db.query(
        'UPDATE user_subscriptions SET is_active = FALSE WHERE id = ?',
        [userSubscriptionId]
    );
    console.log(`[DB] User subscription cancelled: ${userSubscriptionId}`);
    return true;
}

/**
 * Course-Subscription Relationship Operations
 */

/**
 * Link subscription to course(s)
 */
async function linkSubscriptionToCourses(subscriptionId, courseIds) {
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return;
    }

    // Remove existing links for this subscription
    await db.query('DELETE FROM subscription_courses WHERE subscription_id = ?', [subscriptionId]);

    // Add new links
    for (const courseId of courseIds) {
        await db.query(
            'INSERT INTO subscription_courses (subscription_id, course_id) VALUES (?, ?)',
            [subscriptionId, courseId]
        );
    }

    console.log(`[DB] Linked subscription ${subscriptionId} to ${courseIds.length} course(s)`);
}

/**
 * Get courses for a subscription
 */
async function getCoursesForSubscription(subscriptionId) {
    const courses = await db.query(
        `SELECT 
            c.id,
            c.course_name as courseName,
            c.course_description as courseDescription,
            c.created_at as createdAt
         FROM subscription_courses sc
         INNER JOIN courses c ON sc.course_id = c.id
         WHERE sc.subscription_id = ?
         ORDER BY c.course_name ASC`,
        [subscriptionId]
    );

    return courses;
}

/**
 * Get subscriptions for a course
 */
async function getSubscriptionsForCourse(courseId) {
    const subscriptions = await db.query(
        `SELECT 
            s.id,
            s.name,
            s.description,
            s.price,
            s.duration_days as durationDays,
            s.is_active as isActive,
            s.features
         FROM subscription_courses sc
         INNER JOIN subscriptions s ON sc.subscription_id = s.id
         WHERE sc.course_id = ?
         ORDER BY s.price ASC, s.name ASC`,
        [courseId]
    );

    return subscriptions.map(sub => ({
        ...sub,
        features: sub.features ? (typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features) : null
    }));
}

/**
 * Course Enrollment Operations
 */

/**
 * Check if user is enrolled in course
 */
async function isUserEnrolledInCourse(userId, courseId) {
    const enrollments = await db.query(
        'SELECT id FROM course_enrollments WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
    );

    return enrollments.length > 0;
}

/**
 * Enroll user in course (requires active subscription that includes the course)
 */
async function enrollUserInCourse(userId, courseId) {
    // Check if user has an active subscription that includes this course
    const now = new Date();
    const activeSubscriptions = await db.query(
        `SELECT 
            us.subscription_id,
            s.id as subscriptionId
         FROM user_subscriptions us
         INNER JOIN subscriptions s ON us.subscription_id = s.id
         INNER JOIN subscription_courses sc ON s.id = sc.subscription_id
         WHERE us.user_id = ?
           AND us.is_active = TRUE
           AND us.end_date > ?
           AND sc.course_id = ?
         LIMIT 1`,
        [userId, now, courseId]
    );

    if (activeSubscriptions.length === 0) {
        throw new Error('User does not have an active subscription that includes this course');
    }

    const subscriptionId = activeSubscriptions[0].subscriptionId;

    // Check if already enrolled
    const existing = await isUserEnrolledInCourse(userId, courseId);
    if (existing) {
        // Update enrollment with current subscription
        await db.query(
            'UPDATE course_enrollments SET subscription_id = ? WHERE user_id = ? AND course_id = ?',
            [subscriptionId, userId, courseId]
        );
        return { enrolled: true, updated: true };
    }

    // Create enrollment
    await db.query(
        'INSERT INTO course_enrollments (user_id, course_id, subscription_id) VALUES (?, ?, ?)',
        [userId, courseId, subscriptionId]
    );

    console.log(`[DB] User ${userId} enrolled in course ${courseId} with subscription ${subscriptionId}`);
    return { enrolled: true, updated: false };
}

/**
 * Enroll user in course directly (admin function - bypasses subscription requirement)
 */
async function enrollUserInCourseDirectly(userId, courseId) {
    // Check if already enrolled
    const existing = await isUserEnrolledInCourse(userId, courseId);
    if (existing) {
        console.log(`[DB] User ${userId} is already enrolled in course ${courseId}`);
        return { enrolled: true, updated: false };
    }

    // Create enrollment without subscription requirement (subscription_id can be NULL)
    await db.query(
        'INSERT INTO course_enrollments (user_id, course_id) VALUES (?, ?)',
        [userId, courseId]
    );

    console.log(`[DB] User ${userId} enrolled in course ${courseId} directly (admin enrollment)`);
    return { enrolled: true, updated: false };
}

/**
 * Get user's enrolled courses
 */
async function getUserEnrolledCourses(userId) {
    // Try to get enrollments, handling is_active column gracefully
    let enrollments;
    let hasIsActiveColumn = false;
    
    // First, check if is_active column exists by querying table structure
    try {
        const columnCheck = await db.query(
            `SELECT COLUMN_NAME 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'course_enrollments' 
             AND COLUMN_NAME = 'is_active'`
        );
        hasIsActiveColumn = columnCheck.length > 0;
    } catch (error) {
        // If we can't check, assume column doesn't exist
        hasIsActiveColumn = false;
    }
    
    // Now query based on whether column exists
    if (hasIsActiveColumn) {
        enrollments = await db.query(
            `SELECT 
                ce.id as enrollmentId,
                ce.course_id as courseId,
                ce.enrolled_at as enrollmentDate,
                ce.is_active as isActive,
                c.course_name as courseName,
                c.course_description as courseDescription,
                c.created_at as createdAt
             FROM course_enrollments ce
             INNER JOIN courses c ON ce.course_id = c.id
             WHERE ce.user_id = ? AND (ce.is_active IS NULL OR ce.is_active = TRUE)
             ORDER BY ce.enrolled_at DESC`,
            [userId]
        );
    } else {
        enrollments = await db.query(
            `SELECT 
                ce.id as enrollmentId,
                ce.course_id as courseId,
                ce.enrolled_at as enrollmentDate,
                c.course_name as courseName,
                c.course_description as courseDescription,
                c.created_at as createdAt
             FROM course_enrollments ce
             INNER JOIN courses c ON ce.course_id = c.id
             WHERE ce.user_id = ?
             ORDER BY ce.enrolled_at DESC`,
            [userId]
        );
    }

    return enrollments.map(e => ({
        id: e.enrollmentId,
        enrollmentId: e.enrollmentId,
        courseId: e.courseId,
        courseName: e.courseName,
        courseDescription: e.courseDescription,
        enrollmentDate: e.enrollmentDate || e.enrolledAt,
        isActive: hasIsActiveColumn ? (e.isActive !== null ? e.isActive : true) : true,
        createdAt: e.createdAt
    }));
}

/**
 * Cancel/unenroll user from course
 */
async function cancelUserEnrollment(userId, courseId) {
    // Check if is_active column exists, if not, delete the record
    try {
        // Try to update is_active first (if column exists)
        const result = await db.query(
            'UPDATE course_enrollments SET is_active = FALSE WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        
        if (result.affectedRows > 0) {
            console.log(`[DB] User ${userId} unenrolled from course ${courseId} (soft delete)`);
            return true;
        }
        
        // If update didn't work, try delete
        const deleteResult = await db.query(
            'DELETE FROM course_enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        
        if (deleteResult.affectedRows > 0) {
            console.log(`[DB] User ${userId} unenrolled from course ${courseId} (hard delete)`);
            return true;
        }
        
        return false;
    } catch (error) {
        // If column doesn't exist, delete the record
        if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('is_active')) {
            const deleteResult = await db.query(
                'DELETE FROM course_enrollments WHERE user_id = ? AND course_id = ?',
                [userId, courseId]
            );
            console.log(`[DB] User ${userId} unenrolled from course ${courseId} (hard delete)`);
            return deleteResult.affectedRows > 0;
        }
        throw error;
    }
}

/**
 * Check if user can access course (has active subscription for the course OR direct enrollment)
 */
async function canUserAccessCourse(userId, courseId) {
    const now = new Date();

    // Helper to run a query and fallback if is_active column doesn't exist
    const runQueryWithFallback = async (queryWithActive, queryWithoutActive, params) => {
        try {
            return await db.query(queryWithActive, params);
        } catch (error) {
            if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('is_active')) {
                return await db.query(queryWithoutActive, params);
            }
            throw error;
        }
    };

    // First check for direct enrollment (subscription_id is NULL - admin enrolled)
    const directEnrollment = await runQueryWithFallback(
        `SELECT ce.id
         FROM course_enrollments ce
         WHERE ce.user_id = ?
           AND ce.course_id = ?
           AND (ce.is_active IS NULL OR ce.is_active = TRUE)
           AND ce.subscription_id IS NULL
         LIMIT 1`,
        `SELECT ce.id
         FROM course_enrollments ce
         WHERE ce.user_id = ?
           AND ce.course_id = ?
           AND ce.subscription_id IS NULL
         LIMIT 1`,
        [userId, courseId]
    );

    if (directEnrollment.length > 0) {
        return true;
    }

    // Check for enrollment with active subscription
    const subscriptionEnrollment = await runQueryWithFallback(
        `SELECT ce.id
         FROM course_enrollments ce
         INNER JOIN user_subscriptions us ON ce.subscription_id = us.subscription_id
         WHERE ce.user_id = ?
           AND ce.course_id = ?
           AND (ce.is_active IS NULL OR ce.is_active = TRUE)
           AND us.is_active = TRUE
           AND us.end_date > ?
         LIMIT 1`,
        `SELECT ce.id
         FROM course_enrollments ce
         INNER JOIN user_subscriptions us ON ce.subscription_id = us.subscription_id
         WHERE ce.user_id = ?
           AND ce.course_id = ?
           AND us.is_active = TRUE
           AND us.end_date > ?
         LIMIT 1`,
        [userId, courseId, now]
    );

    return subscriptionEnrollment.length > 0;
}

module.exports = {
    // Subscription operations
    createSubscription,
    getAllSubscriptions,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    
    // User subscription operations
    assignSubscriptionToUser,
    getUserActiveSubscription,
    hasActiveSubscription,
    getUserSubscriptions,
    getUserSubscriptionById,
    cancelUserSubscription,
    
    // Course-subscription relationship operations
    linkSubscriptionToCourses,
    getCoursesForSubscription,
    getSubscriptionsForCourse,
    
    // Course enrollment operations
    isUserEnrolledInCourse,
    enrollUserInCourse,
    enrollUserInCourseDirectly,
    getUserEnrolledCourses,
    cancelUserEnrollment,
    canUserAccessCourse
};

