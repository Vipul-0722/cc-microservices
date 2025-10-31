const { redisClient } = require("../config/db");

// Key for trending events (Assumed to be updated by a background job)
const REDIS_KEY_TRENDING = "drs:trending_events";

exports.getRecommendations = async (req, res) => {
  // The authenticated user ID
  const { user_id } = req.params;

  // 1. Try to fetch personalized recommendations from Redis cache
  let recommendations = await redisClient.get(`drs:user:${user_id}`);

  if (recommendations) {
    console.log(`[Cache] Cache hit for user ${user_id}`);
    return res.status(200).send(JSON.parse(recommendations));
  }

  // 2. Cache Miss: Fallback to general trending or cold start logic
  console.log(`[Cache] Cache miss for user ${user_id}. Fetching trending...`);

  // Fallback to trending events list
  let trending = await redisClient.get(REDIS_KEY_TRENDING);

  if (trending) {
    return res.status(200).send(JSON.parse(trending));
  }

  // 3. Complete Cold Start Fallback
  return res.status(200).send({
    results: [],
    message: "No personalized or trending recommendations available.",
  });
};

exports.getTrendingEvents = async (req, res) => {
  console.log("getTrendingEvents called...");
  const trending = await redisClient.get(REDIS_KEY_TRENDING);

  console.log(trending, "got from cache in controller");
  if (trending) {
    return res.status(200).send(JSON.parse(trending));
  }

  return res
    .status(200)
    .send({ results: [], message: "No trending data available." });
};
