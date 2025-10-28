const express = require('express');
const eventRoutes = require('./routes/EventRoutes');
const sequelize = require('./utils/db');
const { connectProducer } = require('./config/kafka'); 
const app = express();
const PORT = 3001; // Use a different port than USS (3000)

app.use(express.json());
app.use('/events', eventRoutes);

sequelize.sync({ alter: true })
    .then(() => {
        console.log('Event DB connected and models synced.');
        return connectProducer(); 
    })

    .then(() => {
        app.listen(PORT, () => {
            console.log(`Event Management Service running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Service failed to start:', err);
        process.exit(1);
    });