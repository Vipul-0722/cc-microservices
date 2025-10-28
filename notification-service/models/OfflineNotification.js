const { DataTypes } = require('sequelize');
const sequelize = require('../utils/db');

const OfflineNotification = sequelize.define('OfflineNotification', {
    notification_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    user_id: { // The recipient of the notification (ID links conceptually to the USS)
        type: DataTypes.UUID,
        allowNull: false,
    },
    payload: { // The full JSON content of the notification (title, message, event_id, etc.)
        type: DataTypes.JSONB,
        allowNull: false,
    },
    is_delivered: { // CRITICAL for Dual Write: True if successfully pushed via WebSocket.
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    is_read: { // True if the user has viewed it (used when retrieved via HTTP)
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'offline_notifications',
    timestamps: false, // We manage 'created_at' manually
});

module.exports = OfflineNotification;