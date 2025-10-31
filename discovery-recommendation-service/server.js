const express = require("express");
const { connectMongoDB, connectRedis } = require("./config/db");
const { runConsumer } = require("./config/kafka");
const discoveryRoutes = require("./routes/DiscoveryRoutes");
const { calculateAndCacheTrending } = require("./workers/recommenderWorker"); // NEW IMPORT

const app = express();
const PORT = 3003; // DRS Port

app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
app.use("/recommendations", discoveryRoutes);

const RECALC_INTERVAL_MS = 60000 * 30; // Recalculate every 30 minutes
// --- Initialization ---
async function bootstrap() {
  try {
    await connectMongoDB();
    await connectRedis();

    await runConsumer(); // Start Kafka consumer for data ingestion

    // --- NEW: Start the background calculation worker ---
    calculateAndCacheTrending(); // Run immediately on startup
    setInterval(calculateAndCacheTrending, RECALC_INTERVAL_MS); // Run periodically
    // --- END NEW ---

    app.listen(PORT, () => {
      console.log(`Discovery & Recommendation Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error("DRS Service failed to start:", err);
    process.exit(1);
  }
}

bootstrap();
