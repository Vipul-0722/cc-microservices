const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { connectedClients, redisClient } = require('../utils/redis'); // RNS State and Redis Client
const OfflineNotification = require('../models/OfflineNotification'); // Persistence Model

// The ID for this specific RNS instance (used for horizontal scaling mapping in Redis)
const RNS_INSTANCE_ID = process.env.RNS_INSTANCE_ID || uuidv4();

/**
 * Handles a new WebSocket connection, authenticates, and maps the user ID to the connection.
 * @param {WebSocket} ws - The active WebSocket connection object.
 * @param {string} userId - The authenticated user's UUID.
 */
function handleConnection(ws, userId) {
    console.log(`[WS] User ${userId} connected.`);

    // 1. Map the connection locally (for instant push)
    connectedClients.set(userId, ws);

    // 2. Map the connection globally in Redis (for horizontal scaling)
    redisClient.hSet('ws:map', userId, RNS_INSTANCE_ID);
    redisClient.sAdd('ws:active_users', userId);

    // 3. Set up disconnection handler
    ws.on('close', () => {
        console.log(`[WS] User ${userId} disconnected.`);
        // Clean up maps upon disconnection
        connectedClients.delete(userId);
        redisClient.hDel('ws:map', userId);
        redisClient.sRem('ws:active_users', userId);
    });

    // 4. On connection, check for offline notifications and send them
    checkAndDeliverOfflineNotifications(userId, ws);
}

/**
 * Checks the persistent database for any missed notifications and pushes them.
 * @param {string} userId - The recipient's UUID.
 * @param {WebSocket} ws - The active connection.
 */
async function checkAndDeliverOfflineNotifications(userId, ws) {
    // Check for notifications that were persisted but never delivered successfully
    const whereCondition = {
        user_id: userId, 
        is_delivered: false 
    };

    try {
        const notifications = await OfflineNotification.findAll({
            where: whereCondition,
            order: [['created_at', 'ASC']]
        });

        if (notifications.length > 0) {
            console.log(`[Offline] Delivering ${notifications.length} missed notifications to ${userId}.`);
            
            const deliveredIds = [];

            for (const notification of notifications) {
                // Attempt to send the message payload
                ws.send(JSON.stringify(notification.payload));
                // If ws.send succeeds (synchronous API call), collect the ID
                deliveredIds.push(notification.notification_id);
            }
            
            // Mark the successfully SENT notifications as delivered/read in the database
            if (deliveredIds.length > 0) {
                 await OfflineNotification.update({ is_delivered: true, is_read: true }, {
                    where: { notification_id: deliveredIds }
                });
            }
        }
    } catch (error) {
        console.error(`[Offline Delivery Error] Failed to fetch or update records for ${userId}:`, error.message);
    }
}


/**
 * Implements the Dual Write Strategy: Always save to DB first, then push via WS.
 * This function guarantees persistence even if the client is offline or the push fails.
 * * @param {string} targetUserId - The UUID of the user to notify.
 * @param {object} notificationPayload - The content of the notification.
 */
async function fanOutNotification(targetUserId, notificationPayload) {
    let notificationRecord;
    let pushSucceeded = false;
    
    try {
        // 1. PERSISTENCE (Guaranteed Write to DB FIRST)
        // Store the notification as 'undelivered' (is_delivered: false)
        notificationRecord = await OfflineNotification.create({
            user_id: targetUserId,
            payload: notificationPayload,
            is_delivered: false, // Default status
            is_read: false       // Default status
        });

        // 2. DELIVERY ATTEMPT (Push is the accelerator)
        const ws = connectedClients.get(targetUserId);

        if (ws && ws.readyState === WebSocket.OPEN) {
            // Attempt instant delivery
            ws.send(JSON.stringify(notificationPayload));
            pushSucceeded = true;
            console.log(`[WS Push] Success to ${targetUserId}. Marking delivered in DB.`);
        } else {
            // User is offline or not locally connected. Persistence already handled this.
            console.warn(`[WS Push] User ${targetUserId} offline. Record persisted (ID: ${notificationRecord.notification_id}).`);
        }

        // 3. CLEANUP: Mark the record as delivered/read ONLY IF the push was attempted and successful
        if (pushSucceeded) {
            await notificationRecord.update({ is_delivered: true, is_read: true });
        }

    } catch (error) {
        // If we fail the initial DB write, the notification is truly lost (CRITICAL FAILURE)
        // If we fail the WS push, the record remains is_delivered: false, which is correct.
        if (notificationRecord) {
            console.error(`[DUAL WRITE ERROR] WS push failed for ${targetUserId}, but record is persisted (ID: ${notificationRecord.notification_id}). Error: ${error.message}`);
        } else {
             console.error(`[CRITICAL PERSISTENCE FAILURE] Notification for ${targetUserId} lost due to DB write error:`, error.message);
        }
    }
}

module.exports = {
    handleConnection,
    fanOutNotification,
    checkAndDeliverOfflineNotifications
};