/**
 * Example usage of the database connection module
 * 
 * This file demonstrates how to use the database connection in your controllers
 */

const db = require('./database');

// Example 1: Simple query
async function getUserById(userId) {
    try {
        const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        return users[0] || null;
    } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
    }
}

// Example 2: Insert query
async function createUser(name, email) {
    try {
        const result = await db.query(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            [name, email]
        );
        return result.insertId;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Example 3: Transaction example
async function transferFunds(fromUserId, toUserId, amount) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // Deduct from sender
        await connection.execute(
            'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
            [amount, fromUserId]
        );
        
        // Add to receiver
        await connection.execute(
            'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
            [amount, toUserId]
        );
        
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        console.error('Transaction failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Example 4: Multiple queries
async function getUserWithDocuments(userId) {
    try {
        const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user[0]) return null;
        
        const documents = await db.query(
            'SELECT * FROM documents WHERE user_id = ?',
            [userId]
        );
        
        return {
            ...user[0],
            documents
        };
    } catch (error) {
        console.error('Error fetching user with documents:', error);
        throw error;
    }
}

module.exports = {
    getUserById,
    createUser,
    transferFunds,
    getUserWithDocuments
};

