const Event = require('../models/Event');
const { publishEvent } = require('../config/kafka');
const { Sequelize } = require('sequelize');
const { Op } = require('sequelize'); 
const EventParticipant = require('../models/EventParticipant'); // New Model
// NOTE: Middleware must run first to populate req.user.id and authorize the host_id

exports.createEvent = async (req, res) => {
    // Host ID comes from the JWT token verified by the API Gateway
    const host_id = req.user.id; 
    const { title, description, date_time, location } = req.body;

    // Basic Validation (e.g., check for required fields)
    if (!title || !date_time || !location) {
        return res.status(400).send({ message: "Missing required event fields." });
    }

    try {
        // 1. Create the event record in the primary database
        const newEvent = await Event.create({
            title, description, date_time, location, host_id
        });

        // 2. Publish the event asynchronously to Kafka
        await publishEvent('event_created', {
            event_id: newEvent.event_id,
            host_id: newEvent.host_id,
            title: newEvent.title,
            date_time: newEvent.date_time
        });

        res.status(201).send({ 
            event_id: newEvent.event_id, 
            message: "Event created successfully and broadcasted." 
        });

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.updateEvent = async (req, res) => {
    const { event_id } = req.params;
    const host_id = req.user.id;
    const updates = req.body;

    try {
        // 1. Check permission and retrieve event
        const event = await Event.findByPk(event_id);
        if (!event) {
            return res.status(404).send({ message: "Event not found." });
        }
        if (event.host_id !== host_id) {
            // Authorization Check (The API Gateway handles Auth, this handles Permission)
            return res.status(403).send({ message: "Forbidden: You are not the event host." });
        }

        // 2. Update the event record
        const [rowsUpdated] = await Event.update(updates, { where: { event_id } });

        if (rowsUpdated > 0) {
            // 3. Publish update event to Kafka (Crucial for Notification Service)
            await publishEvent('event_updated', {
                event_id,
                host_id,
                changes: updates // Send only the fields that changed
            });
            res.status(200).send({ message: "Event updated successfully and broadcasted." });
        } else {
            res.status(400).send({ message: "No changes made or invalid fields provided." });
        }

    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.getEvent = async (req, res) => {
    const { event_id } = req.params;

    try {
        const event = await Event.findByPk(event_id, {
            attributes: ['event_id', 'title', 'description', 'location', 'date_time', 'host_id', 'attendees_count']
        });
        if (!event) {
            return res.status(404).send({ message: "Event not found." });
        }
        res.status(200).send(event);
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.searchEvents = async (req, res) => {

    // Extract query parameters: query (text search), date, category, etc.
    const { query, date, category } = req.query; 

    const where = {};

    // 1. Full-Text Search Filter (using query parameter)
    if (query) {
        // Use the OR operator (Op.or) to search across title and description
        where[Op.or] = [
            { title: { [Op.iLike]: `%${query}%` } }, // Case-insensitive LIKE search
            { description: { [Op.iLike]: `%${query}%` } }
        ];
    }

    // 2. Date Filter (e.g., events scheduled after a certain date)
    // We filter for events that have not passed yet, unless a specific date is provided.
    if (!date) {
        where.date_time = { [Op.gte]: new Date() }; // Only show current/future events
    } else {
        // Find events on or after the specified date
        where.date_time = { [Op.gte]: new Date(date) }; 
    }
    
    // 3. Category Filter (Example, assuming category is a column in the DB)
    if (category) {
        // NOTE: In a real system, categories might be in a separate table
        where.category = category; 
    }

    try {
        const events = await Event.findAll({
            where: where,
            attributes: ['event_id', 'title', 'location', 'date_time', 'host_id', 'attendees_count'],
            order: [['date_time', 'ASC']] // Order by closest date
        });

        res.status(200).send(events);

    } catch (error) {
        console.error('Search events error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.getAllEvents = async (req, res) => {
    try {
        const events = await Event.findAll({
            where: {
                date_time: { [Op.gte]: new Date() } // Only show current/future events
            },
            attributes: ['event_id', 'title', 'location', 'date_time', 'host_id', 'attendees_count'],
            order: [['date_time', 'ASC']]
        });
        res.status(200).send(events);
    } catch (error) {
        console.error('Get all events error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.deleteEventById = async (req, res) => {
    const { id } = req.params;
    const host_id = req.user.id;

    try {
        const event = await Event.findByPk(id);

        if (!event) {
            return res.status(404).send({ message: "Event not found." });
        }

        if (event.host_id !== host_id) {
            return res.status(403).send({ message: "Forbidden: You are not the event host." });
        }

        await event.destroy();

        await publishEvent('event_deleted', { event_id: id, host_id });

        res.status(200).send({ message: "Event deleted successfully." });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.rsvpToEvent = async (req, res) => {
    const { event_id } = req.params;
    const user_id = req.user.id; // The user performing the RSVP

    try {
        // 1. Verify Event Existence
        const event = await Event.findByPk(event_id);
        if (!event) {
            return res.status(404).send({ message: "Event not found." });
        }

        // 2. Create Participation Record (Synchronous Transaction)
        const [participation, created] = await EventParticipant.findOrCreate({
            where: { event_id, user_id },
            defaults: { event_id, user_id }
        });

        if (!created) {
            // User is already registered for this event
            return res.status(409).send({ message: "User is already registered for this event." });
        }

        // 3. Increment the Aggregate Counter (Synchronous Transaction)
        await event.increment('attendees_count', { by: 1 });
        
        // 4. Publish Event Asynchronously
        // This notifies downsteam services (RNS for confirmation alert, DRS for behavior tracking)
        await publishEvent('rsvp_added', {
            event_id: event_id,
            user_id: user_id,
            timestamp: new Date().toISOString()
        });

        res.status(200).send({ message: "RSVP recorded successfully." });

    } catch (error) {
        console.error('RSVP error:', error);
        res.status(500).send({ message: "An internal server error occurred." });
    }
};

exports.cancelRsvp = async (req, res) => {
    const { event_id } = req.params;
    const user_id = req.user.id; // User canceling the RSVP

    try {
        // 1. Verify and Delete the Participation Record (Synchronous Transaction)
        const rowsDeleted = await EventParticipant.destroy({
            where: { event_id, user_id }
        });

        if (rowsDeleted === 0) {
            return res.status(404).send({ message: "RSVP not found for this user and event." });
        }

        // 2. Decrement the Aggregate Counter (Synchronous Transaction)
        await Event.decrement('attendees_count', { by: 1, where: { event_id } });
        
        // 3. Publish Event Asynchronously
        // This notifies downstream services that participation status has changed.
        await publishEvent('rsvp_cancelled', {
            event_id: event_id,
            user_id: user_id,
            timestamp: new Date().toISOString()
        });

        res.status(200).send({ message: "RSVP successfully cancelled." });

    } catch (error) {
        console.error('Cancel RSVP error:', error);
        res.status(500).send({ message: "An internal server error occurred during cancellation." });
    }
};