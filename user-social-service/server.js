const express = require('express');
const userRoutes = require('./routes/UserRoutes');
const sequelize = require('./utils/db'); // Database connection and setup

const app = express();
const PORT = 3000; // Microservice port

app.use(express.json());

// 1. Setup Routes
app.use('/users', userRoutes);

// 2. Start DB connection and Server
sequelize.sync({ alter: true }) // Sync models with database
    .then(() => {
        console.log('Database connected and models synced.');
        app.listen(PORT, () => {
            console.log(`User & Social Service running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });