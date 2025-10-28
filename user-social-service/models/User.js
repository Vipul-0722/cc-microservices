const { DataTypes } = require('sequelize');
const sequelize = require('../utils/db');
const Follower = require('./Follower');

const User = sequelize.define('User', {
    user_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    is_organization: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    // ... other profile fields (bio, profile_picture_url)
}, {
    tableName: 'users',
    timestamps: true, // adds createdAt and updatedAt
    createdAt: 'created_at'
});

User.belongsToMany(User, { 
    as: 'Followers', 
    through: 'followers', 
    foreignKey: 'following_id' // A user being followed is linked via following_id
});
User.belongsToMany(User, { 
    as: 'Following', 
    through: 'followers', 
    foreignKey: 'follower_id' // A user who is following is linked via follower_id
});

// For easier fetching in the controller, explicitly define the reverse relationships:
Follower.belongsTo(User, { foreignKey: 'following_id', as: 'FollowingUser' });
Follower.belongsTo(User, { foreignKey: 'follower_id', as: 'FollowerUser' });

module.exports = User;