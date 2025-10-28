const { Kafka } = require('kafkajs');
const { getFollowers } = require('../services/userServiceClient');
const { fanOutNotification } = require('../services/notificationManager');

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9094';
const TOPIC_EVENTS = 'events';
const TOPIC_USER_EVENTS = 'user_events';
const TOPIC_INTERACTIONS = 'event_interactions';

const kafka = new Kafka({ clientId: 'rns-consumer-group', brokers: [KAFKA_BROKERS] });
const consumer = kafka.consumer({ groupId: 'rns-main-consumer' });

/**
 * Processes messages consumed from Kafka topics and triggers fan-out.
 */
async function processEvent(event) {
    const { type, data } = event;
    let audienceIds = [];
    let notification;

    try {
        switch (type) {
            case 'event_created':
            case 'event_updated':
                // 1. Identify Target Audience (Followers of the host)
                // SYNCHRONOUS REST CALL TO USS: gets the list of user IDs who follow the host
                audienceIds = await getFollowers(data.host_id); 
                
                notification = {
                    message: (type === 'event_created' ? 
                              `NEW EVENT: ${data.title} by ${data.host_id}` : 
                              `UPDATE: Event ${data.title} changed.`),
                    event_id: data.event_id,
                    type: type,
                    timestamp: event.timestamp
                };
                break;

            case 'rsvp_added':
                // 1. Audience is just the user who RSVP'd (for confirmation)
                audienceIds = [data.user_id]; 
                notification = {
                    message: `RSVP Confirmed for event ${data.event_id}.`,
                    event_id: data.event_id,
                    type: 'confirmation',
                    timestamp: event.timestamp
                };
                break;

            case 'user_followed':
                // 1. Audience is the user who was followed (for notification)
                audienceIds = [data.followingId]; 
                notification = {
                    message: `${data.followerId} is now following you.`,
                    user_id: data.followingId,
                    type: 'social',
                    timestamp: event.timestamp
                };
                break;

            default:
                console.log(`[Kafka] Unhandled event type: ${type}`);
                return;
        }

        // 2. Push notification to the entire audience
        for (const userId of audienceIds) {
            fanOutNotification(userId, notification);
        }

    } catch (error) {
        console.error(`[Processor Error] Failed to process ${type} event:`, error);
    }
}

/**
 * Starts the Kafka consumer and subscribes to all necessary topics.
 */
async function runConsumer() {
    const TOPICS = [TOPIC_EVENTS, TOPIC_USER_EVENTS, TOPIC_INTERACTIONS];
    
    try {
        await consumer.connect();
        
        // Subscribe to all topics the RNS needs to react to
        await Promise.all(TOPICS.map(topic => consumer.subscribe({ topic, fromBeginning: false })));

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = JSON.parse(message.value.toString());
                console.log(`[Kafka In] Consumed event: ${event.type} from ${topic}`);
                await processEvent(event);
            },
        });
        console.log("[RNS Consumer] Consumer started, listening to all streams:", TOPICS);
    } catch (error) {
        console.error("[RNS Consumer Error] Failed to start:", error);
    }
}

module.exports = { runConsumer };