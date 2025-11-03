const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const express = require("express");
const axios = require("axios");
const gql = require("graphql-tag");


// --- CONFIGURATION (Internal Service Addresses) ---
const USS_URL = process.env.USS_URL || "http://user-social-service:80";
const EMS_URL = process.env.EMS_URL || "http://event-management-service:80";
const DRS_URL =
  process.env.DRS_URL || "http://discovery-recommendation-service:80";

// --- HELPER FUNCTION: Standardizes User data output ---
const mapUser = (data) => ({
  id: data.user_id || data.id,
  username: data.username,
  // bio: data.bio,
  isOrganization: data.is_organization ?? false,
  followersCount: data.followers_count ?? 0,
});


// --- TYPE DEFINITIONS (SCHEMA) ---
const typeDefs = gql`
  # 1. Base Types (User and Organization)
  type User {
    id: ID!
    username: String!
    bio: String
    isOrganization: Boolean!
    followersCount: Int
    # Note: 'following' resolver is omitted for brevity but would require a separate REST call
    # following: [User] 
    recommendations: [Event!]
    
    # NEW FIELDS FOR USER DASHBOARD:
    attendingEvents: [Event!]
    createdEvents: [Event!]
  }

  # 2. Event Types
  type Event {
    id: ID!
    title: String!
    description: String
    location: String
    dateTime: String!
    attendeesCount: Int
    host: User! # Nested Type (The host's full public profile)
    isAttending(requesterId: ID!): Boolean! # <--- NEW FIELD FOR RSVP CHECK
  }

  # 3. Root Queries (Entry Points)
  type Query {
    event(id: ID!): Event
    user(id: ID!): User
    trendingEvents: [Event!]
    searchEvents(query: String): [Event!]
  }
`;

// --- RESOLVER LOGIC (DATA FETCHING) ---
const resolvers = {
  Query: {
    // 1. Fetch Event by ID (Calls EMS)
    event: async (_, { id }) => {
      try {
        const response = await axios.get(`${EMS_URL}/events/${id}`);
        return response.data;
      } catch (e) {
        console.error("EMS Event Fetch Failed:", e.message);
        throw new Error(`Failed to fetch event with ID ${id}`);
      }
    },

    // 2. Fetch User by ID (Calls USS)
    user: async (_, { id }) => {
      try {
        // USS URL structure: /users/:id
        const response = await axios.get(`${USS_URL}/users/${id}`);
        return mapUser(response.data); // Use mapper to standardize output
      } catch (e) {
        console.error("USS User Fetch Failed:", e.message);
        throw new Error(`Failed to fetch user with ID ${id}`);
      }
    },

    // 3. Trending Events (Calls DRS, then calls EMS for detail)
    trendingEvents: async () => {
      try {
        const summaryResponse = await axios.get(`${DRS_URL}/recommendations/trending`);
        const eventSummaries = summaryResponse.data.results;
        return eventSummaries

      } catch (e) {
        console.error("DRS Trending Fetch Failed:", e.message);
        return [];
      }
    },

    // 4. Search Events (Calls EMS REST endpoint)
    searchEvents: async (_, { query }) => {
        try {
            const response = await axios.get(`${EMS_URL}/events/search?query=${query}`);
            // console.log(response,"data returned..from search")
            return response.data;
        } catch (e) {
            console.error("EMS Search Failed:", e.message);
            return [];
        }
    }
  },

  Event: {
    id: (parent) => parent.event_id || parent.id,
    dateTime: (parent) => parent.date_time,
    attendeesCount : (parent) => parent.attendees_count,
    host: async (parent) => {
      const hostId = parent.host_id;
      if (!hostId) return null;
      try {
        const response = await axios.get(`${USS_URL}/users/${hostId}`);
        return mapUser(response.data); 
      } catch (e) {
        console.error(`Error fetching host profile ${hostId}:`, e.message);
        return null;
      }
    },
    
    // Resolver for 'isAttending': Checks user's RSVP status via EMS
    isAttending: async (parent, args) => {
        const eventId = parent.event_id || parent.id;
        const requesterId = args.requesterId; 

        if (!requesterId) return false; 
        
        try {
            const response = await axios.get(
                `${EMS_URL}/events/${eventId}/rsvp-status`,
                { headers: { 'X-User-ID': requesterId } }
            );
            return response.data.isRsvped;
        } catch (e) {
            console.error(`Error checking attendance for ${requesterId} on event ${eventId}:`, e.message);
            return false;
        }
    }
  },

  User: {
    recommendations: async (parent) => {
      const userId = parent.user_id || parent.id; 
      if (!userId) return [];
      try {
        const response = await axios.get(`${DRS_URL}/recommendations/${userId}`);
        const eventSummaries = response.data.results || [];

        const eventPromises = eventSummaries.map(async (summary) => {
            try {
                const detailResponse = await axios.get(`${EMS_URL}/events/${summary.id || summary.event_id}`);
                return detailResponse.data;
            } catch (e) {
                console.warn(`Skipping recommendation ${summary.id}: Could not fetch details.`);
                return null;
            }
        });

        return (await Promise.all(eventPromises)).filter(Boolean);

      } catch (e) {
        console.error(`Error fetching recommendations for user ${userId}:`, e.message);
        return [];
      }
    },
    
    // NEW RESOLVER: Attending Events (MyEventsScreen tab)
    attendingEvents: async (parent) => {
        const userId = parent.user_id || parent.id;
        if (!userId) return [];
        try {
            const response = await axios.get(`${EMS_URL}/events/attending?userId=${userId}`);
            return response.data; // EMS should return an array of Event objects
        } catch (e) {
            console.error(`Error fetching attending events for ${userId}:`, e.message);
            return [];
        }
    },
    
    // NEW RESOLVER: Created Events (MyEventsScreen tab)
    createdEvents: async (parent) => {
        const userId = parent.user_id || parent.id;
        if (!userId) return [];
        try {
            // Assumes EMS has a REST endpoint: GET /events/created?hostId=...
            const response = await axios.get(`${EMS_URL}/events/created?hostId=${userId}`);
            return response.data; // EMS should return an array of Event objects
        } catch (e) {
            console.error(`Error fetching created events for ${userId}:`, e.message);
            return [];
        }
    }
  },
};

// --- STARTUP ---

const server = new ApolloServer({ typeDefs, resolvers });
const app = express();
const PORT = 3004;

async function startApolloServer() {
  await server.start();
  
  app.use(
    '/graphql',
    express.json(), 
    expressMiddleware(server)
  );

  app.listen({ port: PORT }, () => {
    console.log(`🚀 GraphQL Gateway Service ready at http://localhost:${PORT}/graphql`);
  });
}

startApolloServer();
