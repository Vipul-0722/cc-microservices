const { mongoose } = require("../config/db");

// Define the User Profile Schema for behavioral data
const UserProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Array of event IDs the user has RSVP'd to (for collaborative filtering)
    rsvp_history: [{ type: String }],

    // Array of organization IDs the user follows (for content-based filtering)
    followed_orgs: [{ type: String }],

    // Dynamic map to store calculated interest scores (e.g., {"Tech": 0.8, "Sports": 0.2})
    interest_scores: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

const UserProfile = mongoose.model("UserProfile", UserProfileSchema);
module.exports = UserProfile;
