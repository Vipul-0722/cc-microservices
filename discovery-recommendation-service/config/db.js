const mongoose = require("mongoose"); // MongoDB ORM (npm install mongoose)
const { createClient } = require("redis");

// --- MongoDB Configuration ---
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/campus_connect_drs";

async function connectMongoDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[MongoDB] Connection established successfully.");
  } catch (e) {
    console.error("[MongoDB] Failed to connect on startup:", e);
    process.exit(1);
  }
}

// --- Redis Configuration ---
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
});

redisClient.on("error", (err) =>
  console.error("[Redis] Connection Error:", err)
);

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("[Redis] Connection established successfully.");
  } catch (e) {
    console.error("[Redis] Failed to connect on startup.");
    process.exit(1);
  }
}

module.exports = {
  connectMongoDB,
  connectRedis,
  redisClient,
  mongoose,
};
