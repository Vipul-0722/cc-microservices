const { DataTypes } = require('sequelize');
const sequelize = require('../utils/db');
const Event = require('./Event'); 
const UserStub = require('./UserStub');
const EventParticipant = sequelize.define('EventParticipant', {

    event_id: {
        type: DataTypes.UUID,
        references: {
            model: Event,
            key: 'event_id'
        },
        primaryKey: true
    },
    user_id: { // ID of the user who RSVP'd
        type: DataTypes.UUID,
        // No DB foreign key constraint needed, as the User is in another MS
        primaryKey: true
    }
}, {
    tableName: 'event_participants',
    timestamps: true, // Auto-manages createdAt and updatedAt
    createdAt: 'joined_at', // Rename createdAt to joined_at for clarity
    updatedAt: false // Participation records are usually only created, not updated
});

// Define association helpers (Optional, but useful for joins)
Event.belongsToMany(UserStub, { through: EventParticipant, foreignKey: 'event_id' });
UserStub.belongsToMany(Event, { through: EventParticipant, foreignKey: 'user_id' });

module.exports = EventParticipant;