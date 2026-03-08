# Dockerfile - Frontend React App
# ================================

FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY public ./public
COPY src ./src
COPY tsconfig.json ./

# Build React app
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve to run static app
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/build ./build

# Use .env.local if exists
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/ || exit 1

# Start frontend
CMD ["serve", "-s", "build", "-l", "3001"]
