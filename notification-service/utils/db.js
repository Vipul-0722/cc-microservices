const { Sequelize } = require('sequelize');

// Load environment variables for the RNS's dedicated DB
// NOTE: Must use credentials DIFFERENT from USS and EMS
const DB_NAME = process.env.DB_NAME || 'campus_connect_rns';
const DB_USER = process.env.DB_USER || 'rns_service_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'securepassword_rns';
const DB_HOST = process.env.DB_HOST || 'localhost'; // 'localhost' for local testing (via port-forward)
const DB_PORT = process.env.DB_PORT || 5435;

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

// Function to test the database connection
async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('Notification Service: PostgreSQL Connection established.');
    } catch (error) {
        console.error('Notification Service: Unable to connect to the database:', error);
        process.exit(1); 
    }
}

connectDB();

module.exports = sequelize;