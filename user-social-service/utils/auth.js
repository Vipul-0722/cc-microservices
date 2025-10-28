// NOTE: You would need to install these packages: npm install bcrypt jsonwebtoken
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Environment variables for security (MUST be securely managed)
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_KEY_123';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1d';

/**
 * Hashes a plaintext password using bcrypt.
 * @param {string} password - The user's password.
 * @returns {Promise<string>} The hashed password.
 */
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored hash.
 * @param {string} password - The user-provided password.
 * @param {string} hash - The stored password hash.
 * @returns {Promise<boolean>} True if the passwords match, false otherwise.
 */
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Generates a JWT token for the authenticated user.
 * @param {object} payload - Data to include in the token (e.g., user_id, is_organization).
 * @returns {string} The signed JWT token.
 */
function generateToken(payload) {
    const tokenPayload = {
        user_id: payload.user_id,
        username: payload.username,
        is_organization: payload.is_organization
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRATION,
    });
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken
};