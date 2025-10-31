const { mongoose } = require("../config/db");

// Schema to store data required for recommendation algorithms
const EventFeatureSchema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true },
    title: String,
    host_id: String,
    category: { type: String, index: true },
    // Example field for Content-Based Filtering
    description_keywords: [String],
    // Example field for trending calculation
    recent_rsvps: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const EventFeature = mongoose.model("EventFeature", EventFeatureSchema);
module.exports = EventFeature;
