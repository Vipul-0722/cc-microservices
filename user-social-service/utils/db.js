const { Sequelize } = require('sequelize');

// Load environment variables (In a real app, this would be handled by a package like dotenv or Docker secrets)
const DB_NAME = process.env.DB_NAME || 'campus_connect_users';
const DB_USER = process.env.DB_USER || 'user_service_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'securepassword';
const DB_HOST = process.env.DB_HOST || 'localhost'; // postgres-user-service for prod 
const DB_PORT = process.env.DB_PORT || 5433; // 5432 for prod 
// 32

// Initialize Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: false, // Set to true to see SQL queries in console
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Function to test the database connection
async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        // Exit the process if the database connection fails on startup
        process.exit(1); 
    }
}

// Ensure the connection is established when the service starts
connectDB();

module.exports = sequelize;