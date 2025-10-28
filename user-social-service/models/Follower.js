const { DataTypes } = require('sequelize');
const sequelize = require('../utils/db');
const User = require('./User'); 

const Follower = sequelize.define('Follower', {
    follower_id: {
        type: DataTypes.UUID,
        references: {
            model: User,
            key: 'user_id'
        },
        primaryKey: true // Part of composite key
    },
    following_id: {
        type: DataTypes.UUID,
        references: {
            model: User,
            key: 'user_id'
        },
        primaryKey: true // Part of composite key
    },

}, {
    tableName: 'followers',
    timestamps: true, // Retained: tells Sequelize to manage timestamps
    createdAt: 'created_at', 
});

// NOTE: You must also ensure the associations are defined in User.js 
// or in a separate file *after* both models are required.

module.exports = Follower;