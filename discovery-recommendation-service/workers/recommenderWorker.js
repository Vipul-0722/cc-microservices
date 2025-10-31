// workers/recommenderWorker.js

const { redisClient, mongoose } = require("../config/db");
const EventFeature = require("../models/EventFeature");
const UserProfile = mongoose.model("UserProfile");
const CACHE_KEY_TRENDING = "drs:trending_events";
const { Op } = require("sequelize");

async function calculatePersonalizedRecommendations(userId) {
  // 1. Fetch User Behavior
  const userProfile = await UserProfile.findOne({ user_id: userId });

  if (!userProfile || userProfile.rsvp_history.length === 0) {
    // Cold Start: If no history exists, fall back to trending.
    const trending = await redisClient.get(REDIS_KEY_TRENDING);
    return trending ? JSON.parse(trending).results : [];
  }

  // 2. Identify Interested Categories (Simple Content-Based Filtering)
  // Find the categories of the events the user has RSVP'd to
  const recentEvents = await EventFeature.find({
    event_id: { $in: userProfile.rsvp_history },
  }).select("category");

  // Create a set of unique interested categories (e.g., ['Tech', 'Sports'])
  const interestedCategories = [
    ...new Set(recentEvents.map((e) => e.category)),
  ];

  // 3. Query for New, Unseen Events in Those Categories
  const recommendedEvents = await EventFeature.find({
    // Find events in the interested categories that the user hasn't RSVP'd to yet
    category: { $in: interestedCategories },
    event_id: { $nin: userProfile.rsvp_history }, // Exclude already attended events
  })
    .sort({ recent_rsvps: -1 }) // Prioritize popular events within the interest
    .limit(10)
    .select("event_id title host_id");

  // Return clean payload
  return recommendedEvents.map((e) => ({
    id: e.event_id,
    title: e.title,
    host_id: e.host_id,
  }));
}

/**
 * Periodically calculates and caches the list of trending events.
 * NOTE: For simplicity, this is just a popularity sort.
 */
async function calculateAndCacheTrending() {
  console.log("[Worker] Starting trending calculation...");
  try {
    // 1. Fetch data from MongoDB, ordered by recent RSVP count
    const trendingEvents = await EventFeature.find({})
      .sort({ recent_rsvps: -1, "timestamps.createdAt": -1 }) // Sort by popularity, then recency
      .limit(20)
      .select("event_id title host_id recent_rsvps");

    // 2. Format the result (only send necessary IDs and titles)'
    // console.log(trendingEvents, "from DB trendingEvents");
    const cachedPayload = trendingEvents.map((e) => ({
      id: e.event_id,
      title: e.title,
      rsvps: e.recent_rsvps,
      host_id: e.host_id,
    }));

    console.log(cachedPayload, "cachedPayload");

    // 3. Write results to Redis cache (expire cache after 1 hour)
    const payloadString = JSON.stringify({
      results: cachedPayload,
      calculatedAt: new Date().toISOString(),
    });
    await redisClient.set(CACHE_KEY_TRENDING, payloadString, { EX: 3600 });

    console.log(
      `[Worker] Finished. Cached ${trendingEvents.length} trending events.`
    );
  } catch (error) {
    console.error("[Worker Error] Failed during trending calculation:", error);
  }
}

module.exports = {
  calculateAndCacheTrending,
  calculatePersonalizedRecommendations,
};
