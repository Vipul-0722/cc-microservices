const { Kafka, logLevel, Partitioners  } = require('kafkajs');
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9094';
const TOPIC_EVENTS = 'events';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Enhanced Kafka configuration
const kafka = new Kafka({
    clientId: 'event-management-service',
    brokers: [KAFKA_BROKERS],
    logLevel: logLevel.INFO,
    retry: {
        initialRetryTime: 100,
        retries: MAX_RETRIES,
        maxRetryTime: 30000,
    },
});

const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner 
});
const consumer = kafka.consumer({ 
    groupId: 'ems-consumer-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
});


async function connectProducer() {
    try {
        await producer.connect();
        console.log('[Producer] Kafka Producer connected successfully.');
    } catch (error) {
        console.error('[Producer Error] Initial connection failed:', error);
        // Do not exit, let the application keep retrying the connection during producer.send
    }
}

// --- Producer Logic with retry ---
async function publishEvent(type, payload, retryCount = 0) {
    try {
        const event = { type, timestamp: new Date().toISOString(), data: payload };
        await producer.send({
            topic: TOPIC_EVENTS,
            messages: [{
                key: payload.event_id,
                value: JSON.stringify(event)
            }],
        });
        console.log(`[Producer] Event published: ${type} for ${payload.event_id}`);
    } catch (error) {
        console.error(`[Producer Error] Failed to publish ${type}:`, error);
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying publish in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return publishEvent(type, payload, retryCount + 1);
        }
        throw error;
    }
}

// --- Consumer Logic with reconnection handling ---
// async function runConsumer(retryCount = 0) {
//     try {
//         await consumer.connect();
//         await consumer.subscribe({ 
//             topic: TOPIC_INTERACTIONS, 
//             fromBeginning: false 
//         });

//         await consumer.run({
//             autoCommitInterval: 5000,
//             eachMessage: async ({ topic, partition, message }) => {
//                 try {
//                     const event = JSON.parse(message.value.toString());
//                     const { event_id, user_id, type } = event.data;

//                     if (type === 'rsvp_added') {
//                         await Event.increment('attendees_count', { 
//                             by: 1, 
//                             where: { event_id } 
//                         });
//                         console.log(`[Consumer] Updated attendee count for event: ${event_id}`);
//                     }
//                 } catch (err) {
//                     console.error('[Consumer] Message processing error:', err);
//                 }
//             },
//         });
//         console.log("[Consumer] EMS consumer started, listening for interactions.");
//     } catch (error) {
//         console.error("[Consumer Error] Failed to start consumer:", error);
//         if (retryCount < MAX_RETRIES) {
//             const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
//             console.log(`Retrying consumer connection in ${delay}ms... (${retryCount + 1}/${MAX_RETRIES})`);
//             await new Promise(resolve => setTimeout(resolve, delay));
//         }
//         throw error;
//     }
// }

// Graceful shutdown handler
const gracefulShutdown = async () => {
    try {
        await consumer.disconnect();
        await producer.disconnect();
        console.log('Gracefully disconnected from Kafka');
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { publishEvent, connectProducer };