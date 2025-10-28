# Stage 1: Builder - Installs dependencies
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install 

# Stage 2: Final image - Copies only runtime files
FROM node:20-alpine

WORKDIR /app

# Copy installed node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the application source code
COPY . .

# Expose the port the RNS application listens on (3002)
EXPOSE 3002

# Define the entry point
CMD ["node", "server.js"]
