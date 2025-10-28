# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Stage 2: Final image
FROM node:20-alpine

WORKDIR /app

# Copy installed modules and application code
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose the microservice port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]