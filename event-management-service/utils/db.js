const { Sequelize } = require('sequelize');

const DB_NAME = process.env.DB_NAME || 'campus_connect_events';
const DB_USER = process.env.DB_USER || 'event_service_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'securepassword_events'; 
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5434;

// Initialize Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('Event Management Service: PostgreSQL Connection established.');
    } catch (error) {
        console.error('Event Management Service: Unable to connect to the database:', error);
        process.exit(1); 
    }
}

connectDB();

module.exports = sequelize;