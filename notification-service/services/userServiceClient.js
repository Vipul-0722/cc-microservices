// NOTE: Requires 'axios' for HTTP calls (npm install axios)
const axios = require('axios');

// Environment variable pointing to the User & Social Service (USS)
// In a K8s deployment: http://user-social-service.campus-connect:3000
const USS_URL = process.env.USS_BASE_URL || 'http://localhost:3000'; 
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Synchronously retrieves the list of followers for a given host ID,
 * implementing a simple retry mechanism for resilience.
 * * @param {string} hostId - The user ID whose followers are being requested (the event host).
 * @returns {Promise<string[]>} An array of follower user IDs (UUID strings).
 */
async function getFollowers(hostId) {
    const url = `${USS_URL}/users/${hostId}/followers`;
    
    // --- Resilience: Simple Retry Loop ---
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[USS Client] Fetching followers for ${hostId} (Attempt ${attempt}/${MAX_RETRIES})`);
            
            // The RNS itself does not need to send an X-User-ID as it is acting as a trusted backend service
            // that is only fetching public or derived data.
            const response = await axios.get(url);
            
            // Assuming the USS returns: { followers: [{user_id: 'uuid-1', ...}, ...] }
            return response.data.followers.map(f => f.user_id);

        } catch (error) {
            if (attempt === MAX_RETRIES) {
                // If max retries reached, log failure and return empty array.
                console.error(`[USS Client ERROR] Max retries reached. Failed to fetch followers for ${hostId}. USS may be unavailable.`);
                
                // CRITICAL: Returning an empty array demonstrates resilience and prevents cascading failure.
                // Notifications are simply skipped for this event, preventing the RNS from blocking.
                return []; 
            }
            
            // Log retry and wait
            console.warn(`[USS Client WARN] Connection failed. Retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
    return []; // Should not be reached, but ensures return type.
}

module.exports = { getFollowers };
