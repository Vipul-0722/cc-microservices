FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies (including mongoose, kafkajs)
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy application source code
COPY . .

# --- Stage 2: Serve the Application ---
FROM node:20-alpine

WORKDIR /app

# Copy installed modules and source code
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose the DRS port
EXPOSE 3003

# Command to start the application
CMD ["node", "server.js"]