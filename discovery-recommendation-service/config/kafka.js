const { Kafka } = require("kafkajs");
const { redisClient } = require("./db");
const EventFeature = require("../models/EventFeature");
const UserProfile = require("../models/UserProfile");
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || "localhost:9092";

const TOPIC_EVENTS = "events";
const TOPIC_INTERACTIONS = "event_interactions";
const TOPIC_USER_EVENTS = "user_events";

const kafka = new Kafka({
  clientId: "drs-consumer-group",
  brokers: [KAFKA_BROKERS],
});
const consumer = kafka.consumer({ groupId: "drs-main-consumer" });

async function updateUserProfile(userId, field, value, action = "$push") {
  // Finds or creates the profile, then updates the specified array field
  await UserProfile.findOneAndUpdate(
    { user_id: userId },
    {
      $setOnInsert: { user_id: userId }, // Ensure user_id is set if new document
      [action]: { [field]: value }, // Use $push or $pull based on action
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Processes messages consumed from Kafka topics and updates internal data stores.
 */
async function processEvent(event) {
  const { type, data } = event;

  try {
    switch (type) {
      case "event_created":
        // Action: Ingest new event data into MongoDB
        console.log("Consuming event created..");
        await EventFeature.create({
          event_id: data.event_id,
          title: data.title,
          host_id: data.host_id,
          category: "Unknown",
        });
        console.log(
          `[DRS Ingest] Created new event feature record: ${data.event_id}`
        );
        break;

      case "event_deleted":
        // Action: Remove event from MongoDB
        console.log("Consuming event deleted..");
        await EventFeature.deleteOne({ event_id: data.event_id });
        // Future: Invalidate related Redis caches
        break;

      case "rsvp_added":
        // Action: Update aggregate count in MongoDB (for trending)
        await EventFeature.updateOne(
          { event_id: data.event_id },
          { $inc: { recent_rsvps: 1 } }
        );
        // Action 2 (NEW): Update UserProfile RSVP history
        await updateUserProfile(
          data.user_id,
          "rsvp_history",
          data.event_id,
          "$push"
        );
        console.log(`[DRS Update] User ${data.user_id} RSVP recorded.`);
        console.log(
          `[DRS Update] Incremented RSVP count for event: ${data.event_id}`
        );
        break;

      case "user_followed":
        // Action (NEW): Update UserProfile with the new followed organization
        // Note: Assumes the followed entity (followingId) is an organization
        await updateUserProfile(
          data.followerId,
          "followed_orgs",
          data.followingId,
          "$push"
        );
        console.log(
          `[DRS Ingest] User ${data.followerId} followed entity ${data.followingId}.`
        );
        break;

      case "user_unfollowed":
        await updateUserProfile(
          data.followerId,
          "followed_orgs",
          data.followingId,
          "$pull"
        );
        console.log(
          `[DRS Ingest] User ${data.followerId} unfollowed entity ${data.followingId}.`
        );
        break;

      default:
        break;
    }

    // NOTE: A separate, periodic job would run in the background to calculate
    // recommendations and cache the results in Redis based on the data ingested here.
  } catch (error) {
    // If processing fails, it's a soft failure; log and continue.
    console.error(
      `[DRS Processor Error] Failed to process ${type}:`,
      error.message
    );
  }
}

async function runConsumer() {
  const TOPICS = [TOPIC_EVENTS, TOPIC_INTERACTIONS, TOPIC_USER_EVENTS];

  try {
    await consumer.connect();
    await Promise.all(
      TOPICS.map((topic) => consumer.subscribe({ topic, fromBeginning: false }))
    );

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value.toString());
        await processEvent(event);
      },
    });
    console.log("[DRS Consumer] Consumer started, listening to streams.");
  } catch (error) {
    console.error("[DRS Consumer Error] Failed to start:", error);
  }
}

module.exports = { runConsumer };
