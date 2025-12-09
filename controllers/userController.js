const bcrypt = require('bcrypt');
const db = require('../config/database');
const subscriptionUtils = require('../utils/subscriptionUtils');

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Get all users
 * GET /api/users
 */
async function getAllUsers(req, res) {
    try {
        const users = await db.query(
            `SELECT 
                id,
                email,
                name,
                role,
                is_active,
                created_at,
                updated_at,
                last_login
             FROM users
             ORDER BY created_at DESC`
        );

        // Get subscription info for each user
        const usersWithSubscriptions = await Promise.all(users.map(async (user) => {
            const subscription = await subscriptionUtils.getUserActiveSubscription(user.id);
            return {
                id: user.id,
                email: user.email,
                name: user.name || null,
                role: user.role,
                isActive: user.is_active,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                lastLogin: user.last_login,
                subscription: subscription ? {
                    id: subscription.id,
                    subscriptionId: subscription.subscriptionId,
                    subscriptionName: subscription.subscriptionName,
                    endDate: subscription.endDate,
                    isActive: subscription.isActive
                } : null
            };
        }));

        res.json(usersWithSubscriptions);
    } catch (error) {
        console.error("[Users List Error]:", error);
        res.status(500).json({
            error: 'Failed to list users.',
            details: error.message
        });
    }
}

/**
 * Get user by ID
 * GET /api/users/:userId
 */
async function getUserById(req, res) {
    try {
        const { userId } = req.params;

        const users = await db.query(
            `SELECT 
                id,
                email,
                name,
                role,
                is_active,
                created_at,
                updated_at,
                last_login
             FROM users
             WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        res.json({
            id: user.id,
            email: user.email,
            name: user.name || null,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            lastLogin: user.last_login
        });
    } catch (error) {
        console.error("[User Get Error]:", error);
        res.status(500).json({
            error: 'Failed to get user.',
            details: error.message
        });
    }
}

/**
 * Create a new user
 * POST /api/users
 */
async function createUser(req, res) {
    try {
        const { email, password, name, role = 'user', isActive = true } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate role
        if (role && !['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Role must be either "admin" or "user"' });
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUsers = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
            `INSERT INTO users (email, password, name, role, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [
                normalizedEmail,
                hashedPassword,
                name || null,
                role,
                isActive === true || isActive === 'true'
            ]
        );

        // Get created user
        const newUser = await db.query(
            `SELECT 
                id,
                email,
                name,
                role,
                is_active,
                created_at,
                updated_at,
                last_login
             FROM users
             WHERE id = ?`,
            [result.insertId]
        );

        console.log(`[DB] User created successfully: ${newUser[0].id} - ${newUser[0].email}`);

        res.status(201).json({
            id: newUser[0].id,
            email: newUser[0].email,
            name: newUser[0].name || null,
            role: newUser[0].role,
            isActive: newUser[0].is_active,
            createdAt: newUser[0].created_at,
            updatedAt: newUser[0].updated_at,
            lastLogin: newUser[0].last_login
        });
    } catch (error) {
        console.error("[User Create Error]:", error);
        res.status(500).json({
            error: 'Failed to create user.',
            details: error.message
        });
    }
}

/**
 * Update user
 * PUT /api/users/:userId
 */
async function updateUser(req, res) {
    try {
        const { userId } = req.params;
        const { email, password, name, role, isActive } = req.body;

        // Check if user exists
        const existingUsers = await db.query(
            'SELECT id, email FROM users WHERE id = ?',
            [userId]
        );

        if (existingUsers.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updates = [];
        const values = [];

        // Update email if provided
        if (email !== undefined) {
            if (!isValidEmail(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
            const normalizedEmail = email.toLowerCase().trim();
            
            // Check if email is already taken by another user
            const emailCheck = await db.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [normalizedEmail, userId]
            );
            
            if (emailCheck.length > 0) {
                return res.status(409).json({ error: 'Email already in use by another user' });
            }
            
            updates.push('email = ?');
            values.push(normalizedEmail);
        }

        // Update password if provided
        if (password !== undefined) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        // Update name if provided
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name || null);
        }

        // Update role if provided
        if (role !== undefined) {
            if (!['admin', 'user'].includes(role)) {
                return res.status(400).json({ error: 'Role must be either "admin" or "user"' });
            }
            updates.push('role = ?');
            values.push(role);
        }

        // Update is_active if provided
        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(isActive === true || isActive === 'true');
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(userId);

        await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        console.log(`[DB] User updated successfully: ${userId}`);

        // Get updated user
        const updatedUser = await db.query(
            `SELECT 
                id,
                email,
                name,
                role,
                is_active,
                created_at,
                updated_at,
                last_login
             FROM users
             WHERE id = ?`,
            [userId]
        );

        res.json({
            id: updatedUser[0].id,
            email: updatedUser[0].email,
            name: updatedUser[0].name || null,
            role: updatedUser[0].role,
            isActive: updatedUser[0].is_active,
            createdAt: updatedUser[0].created_at,
            updatedAt: updatedUser[0].updated_at,
            lastLogin: updatedUser[0].last_login
        });
    } catch (error) {
        console.error("[User Update Error]:", error);
        res.status(500).json({
            error: 'Failed to update user.',
            details: error.message
        });
    }
}

/**
 * Delete user
 * DELETE /api/users/:userId
 */
async function deleteUser(req, res) {
    try {
        const { userId } = req.params;

        // Check if user exists
        const existingUsers = await db.query(
            'SELECT id, email FROM users WHERE id = ?',
            [userId]
        );

        if (existingUsers.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deleting yourself
        if (req.session && req.session.userId && parseInt(req.session.userId) === parseInt(userId)) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        await db.query('DELETE FROM users WHERE id = ?', [userId]);

        console.log(`[DB] User deleted successfully: ${userId}`);

        res.json({
            message: 'User deleted successfully',
            userId
        });
    } catch (error) {
        console.error("[User Delete Error]:", error);
        res.status(500).json({
            error: 'Failed to delete user.',
            details: error.message
        });
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};

