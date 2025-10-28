const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");
const { authenticate, authorizeUserAccess } = require("../middleware/auth"); // Import middleware

// ----------------------------------------------------------------------
// 1. PUBLIC ENDPOINTS
// ----------------------------------------------------------------------

router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);

// Profile viewing is public and should not require authentication
router.get("/:user_id", userController.getProfile);

// ----------------------------------------------------------------------
// 2. AUTHENTICATED ENDPOINTS
// ----------------------------------------------------------------------

// Apply the 'authenticate' middleware to all routes *below* this line.
// This is the clean, correct place for it.
router.use(authenticate);

// --- Social Connections (All require authentication) ---

/**
 * @route POST /users/:user_id/follow
 * @description Creates a follow relationship. Requires both authenticate and authorize.
 * @access Authenticated & Authorized
 */
router.post(
  "/:user_id/follow",
  authenticate,
  authorizeUserAccess,
  userController.followUser
);

/**
 * @route DELETE /users/:user_id/follow/:target_user_id
 * @description Deletes a follow relationship.
 * @access Authenticated & Authorized
 */
router.delete(
  "/:user_id/follow/:target_user_id",
  authorizeUserAccess,
  userController.unfollowUser
);

/**
 * @route GET /users/:user_id/following
 * @description Gets the list of users and organizations followed by {user_id}.
 * @access Authenticated
 */
router.get("/:user_id/following", userController.getFollowing);

/**
 * @route GET /users/:user_id/followers
 * @description Gets the list of followers for {user_id}.
 * @access Authenticated
 */
router.get("/:user_id/followers", userController.getFollowers);

router.get("/search", userController.searchUsers);

module.exports = router;
