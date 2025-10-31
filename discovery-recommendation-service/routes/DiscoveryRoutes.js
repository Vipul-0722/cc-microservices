const express = require("express");
const router = express.Router();
const discoveryController = require("../controllers/DiscoveryController");
// NOTE: We don't need authentication middleware here yet, as authentication
// is typically handled by the API Gateway before hitting this service.

// This router handles requests prefixed with /recommendations (as defined in server.js)

// ----------------------------------------------------------------------
// 1. GENERAL DISCOVERY (Global Data)
// ----------------------------------------------------------------------

/**
 * @route GET /recommendations/trending
 * @description Retrieves a globally cached list of the most popular events.
 * @access Public
 */
router.get("/trending", discoveryController.getTrendingEvents);

// ----------------------------------------------------------------------
// 2. PERSONALIZED RECOMMENDATIONS (Requires a User ID)
// ----------------------------------------------------------------------

/**
 * @route GET /recommendations/:user_id
 * @description Retrieves a personalized list of recommended events for the user.
 * @access Public (or handled by Gateway auth)
 */
router.get("/:user_id", discoveryController.getRecommendations);

module.exports = router;
