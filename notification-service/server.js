const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const { connectRedis, redisClient } = require("./utils/redis");
const { runConsumer } = require("./config/kafka.js");
const { handleConnection } = require("./services/notificationManager");
// CRITICAL IMPORTS
const sequelize = require("./utils/db"); // Imports the Sequelize instance
const OfflineNotification = require("./models/OfflineNotification"); // Imports the Model for syncing

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// --- Simple HTTP Endpoint for Health Check / Offline Notification Retrieval ---
// NOTE: This endpoint now correctly uses the imported OfflineNotification model.
app.get("/notifications/:user_id", async (req, res) => {
  // In a microservice environment, the user_id should be checked against an Auth Header/Token
  const { user_id } = req.params;

  try {
    const notifications = await OfflineNotification.findAll({
      where: { user_id, is_read: false, is_delivered: true }, // Filter: delivered but not read
      order: [["created_at", "DESC"]],
    });

    // Mark retrieved notifications as read immediately
    await OfflineNotification.update(
      { is_read: true },
      {
        where: { user_id, is_read: false },
      }
    );

    if (notifications.length === 0) {
      return res.status(200).send({
        notifications: [],
        message: "No unread offline notifications.",
      });
    }

    res.status(200).send({
      notifications: notifications.map((n) => n.payload),
    });
  } catch (error) {
    console.error("Retrieve notifications error:", error);
    res.status(500).send({ message: "Failed to retrieve notifications." });
  }
});

app.get("/health", (req, res) => {
  res.status(200).send({
    status: "OK",
    service: "Real-time Notification Service",
    redis_status: redisClient.status,
  });
});

// --- WebSocket Server Setup ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (token) {
    handleConnection(ws, token);
  } else {
    ws.close(1008, "Unauthorized: Missing auth token");
  }

  ws.on("error", (err) => console.error("[WS Error]", err));
});

// --- Service Initialization ---

async function bootstrap() {
  try {
    // 1. Initialize Redis Connection (must be first as it's critical for WS handling)
    await connectRedis();
    console.log("Redis Client initialized.");

    // 2. Initialize and Synchronize PostgreSQL DB (CRITICAL STEP ADDED HERE)
    await sequelize.authenticate(); // Test connection
    await sequelize.sync({ alter: true }); // Sync models/create tables
    console.log("Offline Notification DB connected and models synced.");

    // 3. Start Kafka Consumer (Begins listening for events)
    await runConsumer();
    console.log("Kafka Consumer running.");

    // 4. Start HTTP/WebSocket Server
    server.listen(PORT, () => {
      console.log(`RNS Service running (HTTP/WS) on port ${PORT}`);
    });
  } catch (error) {
    console.error("RNS Bootstrap Failed:", error);
    process.exit(1);
  }
}

bootstrap();

// --- Graceful Shutdown ---
process.on("SIGINT", async () => {
  console.log("\n[Shutdown] Disconnecting consumers and closing server...");
  if (wss) wss.close();
  // Proper shutdown logic for consumer and redis should be implemented here
  process.exit(0);
});
