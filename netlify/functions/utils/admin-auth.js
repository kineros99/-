/**
 * ============================================================================
 * Admin Authentication Utility
 * ============================================================================
 *
 * Centralized authentication for admin operations.
 * Supports multiple admin credentials.
 *
 * Usage:
 * import { verifyAdminCredentials } from './utils/admin-auth.js';
 *
 * const isValid = verifyAdminCredentials(username, password);
 * if (!isValid) {
 *   return unauthorized response...
 * }
 */

// Admin credentials: username -> password mapping
const ADMIN_CREDENTIALS = {
    'kinEROS': process.env.ADMIN_PASSWORD || '123',
    'student': '999'
};

/**
 * Verify admin credentials (username + password)
 * @param {string} username - The username to verify
 * @param {string} password - The password to verify
 * @returns {boolean} - True if credentials are valid, false otherwise
 */
export function verifyAdminCredentials(username, password) {
    if (!username || !password) {
        return false;
    }

    const expectedPassword = ADMIN_CREDENTIALS[username];

    if (!expectedPassword) {
        console.log(`[Admin-Auth] ❌ Unknown username: ${username}`);
        return false;
    }

    if (password !== expectedPassword) {
        console.log(`[Admin-Auth] ❌ Invalid password for user: ${username}`);
        return false;
    }

    console.log(`[Admin-Auth] ✅ Valid credentials for user: ${username}`);
    return true;
}

/**
 * Get list of valid admin usernames (for frontend validation)
 * @returns {string[]} - Array of valid usernames
 */
export function getValidAdminUsernames() {
    return Object.keys(ADMIN_CREDENTIALS);
}
