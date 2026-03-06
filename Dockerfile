# Build Stage
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies
# better-sqlite3 needs python and build-essential to compile from source if binaries aren't available
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

# We need tsx to run the server.ts directly
RUN npm install -g tsx

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the port the app runs on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["tsx", "server.ts"]
