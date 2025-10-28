const { createClient } = require("redis");

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || ""; // Set if Redis requires auth

const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  password: REDIS_PASSWORD,
});

const connectedClients = new Map();

redisClient.on("error", (err) => {
  console.error("[Redis] Connection Error:", err);
});

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("[Redis] Connection established successfully.");
    return redisClient;
  } catch (e) {
    console.error("[Redis] Failed to connect on startup.");
    // In a real K8s setup, you might retry connection instead of exiting immediately
    process.exit(1);
  }
}

// Export the client and connection function
module.exports = { connectRedis, redisClient, connectedClients };
