const { DataTypes } = require('sequelize');
const sequelize = require('../utils/db');

// This model represents the User entity residing in the User & Social Service.
// It is a "stub" used only for defining associations (junction table).
const UserStub = sequelize.define('UserStub', {
    user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false
    }
}, {
    tableName: 'users', // Use the actual table name from the USS
    timestamps: false,
    // CRITICAL: Disable table synchronization for this model
    // This tells Sequelize NOT to create or modify a 'users' table in the EMS DB.
    freezeTableName: true, 
    sync: { force: false, alter: false } 
});

module.exports = UserStub;