// NOTE: Using 'kafkajs' library for Node.js
const { Kafka } = require('kafkajs');
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9094'];
// campus-kafka-cluster-kafka-brokers.kafka.svc.cluster.local:9092 for prod 


const kafka = new Kafka({
    clientId: 'user-social-service',
    brokers: KAFKA_BROKERS, // Use the service name and port in your Docker/K8s environment
});

const producer = kafka.producer();
producer.connect();

const TOPIC_USER_EVENTS = 'user_events';

/**
 * Publishes an event to the 'user_events' Kafka topic.
 * @param {string} type - The event type (e.g., 'user_followed', 'user_unfollowed').
 * @param {object} payload - The event data.
 */
async function publishUserEvent(type, payload) {
    
    // 1. Determine the key based on the follower ID (the entity that changed the state)
    // We assume payload.followerId is a string or UUID.
    const partitionKey = payload.followerId; 

    // 2. Structure the full event object
    const event = {
        type,
        timestamp: new Date().toISOString(),
        data: payload // Contains followerId and followingId
    };

    await producer.send({
        topic: TOPIC_USER_EVENTS,
        messages: [{
            // FIX: Use the followerId as the key for partitioning
            key: partitionKey, 
            value: JSON.stringify(event)
        }],
    });
    console.log(`Published event: ${type}`);
}

module.exports = { publishUserEvent };