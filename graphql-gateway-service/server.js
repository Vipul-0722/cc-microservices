const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const express = require("express");
const axios = require("axios"); // For making REST calls to other MS
const gql = require("graphql-tag");

const USS_URL = process.env.USS_URL || "http://user-social-service:80/users";
const EMS_URL =
  process.env.EMS_URL || "http://event-management-service:80/events";
const DRS_URL =
  process.env.DRS_URL ||
  "http://discovery-recommendation-service:80/recommendations";

const typeDefs = gql`
  # 1. Base Types (User and Organization)
  type User {
    id: ID!
    username: String!
    isOrganization: Boolean!
    followersCount: Int
    following: [User]
    recommendations: [Event!]
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
  }

  # 3. Root Queries (Entry Points)
  type Query {
    # Fetches a specific event and allows nested data
    event(id: ID!): Event
    # Fetches a user's profile and allows nested data
    user(id: ID!): User
    # Fetches the globally trending events from the DRS
    trendingEvents: [Event!]
    # Searches for events using REST logic but returns GraphQL structure
    searchEvents(query: String): [Event!]
  }
`;

const mapUser = (user) => ({
  id: user.user_id || user.id,
  username: user.username,
  isOrganization: user.isOrganization ?? false,
  //   bio: user?.bio || null,
});

// --- RESOLVER LOGIC (DATA FETCHING) ---
const resolvers = {
  Query: {
    // 1. Fetch Event by ID (Calls EMS)
    event: async (_, { id }) => {
      try {
        const response = await axios.get(`${EMS_URL}/${id}`);
        return response.data;
      } catch (e) {
        console.error("EMS Event Fetch Failed:", e.message);
        throw new Error(`Failed to fetch event with ID ${id}`);
      }
    },

    // 2. Fetch User by ID (Calls USS)
    user: async (_, { id }) => {
      try {
        const response = await axios.get(`${USS_URL}/${id}`);
        return response.data;
      } catch (e) {
        console.error("USS User Fetch Failed:", e.message);
        throw new Error(`Failed to fetch user with ID ${id}`);
      }
    },

    // 3. Trending Events (Calls DRS)
    trendingEvents: async () => {
      try {
        const response = await axios.get(`${DRS_URL}/trending`);
        const trendingEventIds = response.data.results;

        // Fetch full event details for each trending event
        const eventPromises = trendingEventIds.map(async (eventSummary) => {
          try {
            const eventResponse = await axios.get(
              `${EMS_URL}/${eventSummary.id}`
            );
            return eventResponse.data;
          } catch (e) {
            console.error(
              `Failed to fetch event details for ${eventSummary.id}:`,
              e.message
            );
            // Return the basic data from DRS if EMS call fails
            return {
              id: eventSummary.id,
              title: eventSummary.title,
              description: null,
              location: null,
              dateTime: null,
              attendeesCount: eventSummary.rsvps || 0,
              host_id: eventSummary.host_id,
            };
          }
        });

        const fullEvents = await Promise.all(eventPromises);
        return fullEvents;
        // // The DRS returns {results: [...]}, we return the array.
        // return response.data.results;
      } catch (e) {
        console.error("DRS Trending Fetch Failed:", e.message);
        return [];
      }
    },

    // 4. Search Events (Calls EMS REST endpoint)
    searchEvents: async (_, { query }) => {
      try {
        const response = await axios.get(`${EMS_URL}/search?query=${query}`);
        return response.data;
      } catch (e) {
        console.error("EMS Search Failed:", e.message);
        return [];
      }
    },
  },

  // --- NESTED RESOLVERS (API COMPOSITION) ---

  Event: {
    // Resolver for 'host' field: takes data from the parent Event object (which has host_id)
    // and fetches the full profile from USS.
    host: async (parent) => {
      // Parent is the Event object returned from EMS ({id: ..., host_id: 'uuid'})
      const hostId = parent.host_id;
      if (!hostId) return null;
      try {
        const response = await axios.get(`${USS_URL}/${hostId}`);
        return mapUser(response.data);
        // return response.data; // Returns the User object to the GraphQL response
      } catch (e) {
        console.error(`Error fetching host profile ${hostId}:`, e.message);
        return null;
      }
    },
  },

  User: {
    // Resolver for 'recommendations' field: calls the DRS using the parent User's ID
    recommendations: async (parent) => {
      // Parent is the User object returned from USS ({id: 'uuid', username: '...' })
      const userId = parent.user_id || parent.id; // Handles various ID formats
      if (!userId) return [];
      try {
        const response = await axios.get(`${DRS_URL}/${userId}`);
        return mapUser(response.data.results);
        // return response.data.results;
      } catch (e) {
        console.error(
          `Error fetching recommendations for user ${userId}:`,
          e.message
        );
        return [];
      }
    },
  },
};

// --- STARTUP ---

const server = new ApolloServer({ typeDefs, resolvers });
const app = express();

// Apply GraphQL middleware to a single endpoint
async function startApolloServer() {
  await server.start();

  // NEW: Use expressMiddleware for modern integration
  // This automatically sets up the JSON body parsing and context.
  app.use(
    "/graphql",
    express.json(), // Ensure body parsing is done before middleware
    expressMiddleware(server)
  );

  app.listen({ port: 3004 }, () => {
    console.log(
      `🚀 GraphQL Gateway Service ready at http://localhost:3004/graphql`
    );
  });
}

startApolloServer();
