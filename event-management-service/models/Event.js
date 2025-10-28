const { DataTypes } = require('sequelize');
const sequelize = require('../utils/db');

const Event = sequelize.define('Event', {
    event_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    host_id: { // Conceptual foreign key to User & Social Service
        type: DataTypes.UUID,
        allowNull: false
    },
    date_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    attendees_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'events',
    timestamps: true, // Auto-manages createdAt (created_at) and updatedAt (updated_at)
    createdAt: 'created_at', // Map Sequelize's name to DB's name
    updatedAt: 'updated_at',
});

module.exports = Event;