// routes/EventRoutes.js (Updated)

// NOTE: This assumes 'authenticate' and 'authorizeHost' (a custom middleware) are defined.
const express = require("express");
const router = express.Router();
const eventController = require("../controllers/EventController");
const { authenticate } = require("../middleware/auth"); // Import authentication middleware

// ----------------------------------------------------------------------
// 1. PUBLIC READ ENDPOINTS
// ----------------------------------------------------------------------

// Search endpoint is public for general browsing
router.get("/search", eventController.searchEvents);

router.get("/", eventController.getAllEvents);

// Retrieve single event details is public
router.get("/:event_id", eventController.getEvent);

// ----------------------------------------------------------------------
// 2. AUTHENTICATED/AUTHORIZED ENDPOINTS
// ----------------------------------------------------------------------

router.use(authenticate); // All routes below this line require a JWT token

/**
 * @route POST /events
 * @description Creates a new event (Authenticated User is the Host).
 */
router.post("/", eventController.createEvent);

/**
 * @route PUT /events/:event_id
 * @description Updates an existing event. Authorization check happens *inside* the controller.
 */
router.put("/:event_id", eventController.updateEvent);

/**
 * @route DELETE /events/:event_id
 * @description Deletes an event. Authorization check happens *inside* the controller.
 */
router.delete("/:event_id", eventController.deleteEventById);

/**
 * @route POST /events/:event_id/rsvp
 * @description Records a user's participation in an event.
 * @access Authenticated (The user_id is taken from the token)
 */
router.post("/:event_id/rsvp", eventController.rsvpToEvent);

/**
 * @route DELETE /events/:event_id/rsvp
 * @description Removes a user's participation record (cancels RSVP).
 * @access Authenticated
 */
router.delete("/:event_id/rsvp", eventController.cancelRsvp);

module.exports = router;
