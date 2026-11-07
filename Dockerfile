# Dockerfile for BOTAIRDROP Multi-Agent System
# Multi-stage build for production optimization

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production

# Set non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/.env.example ./

# Create logs directory
RUN mkdir -p /app/logs && chown appuser:appgroup /app/logs

# Switch to non-root user
USER appuser

# Expose ports (for monitoring/health checks)
EXPOSE 3000
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/scripts/health-check.js || exit 1

# Environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Entrypoint
ENTRYPOINT ["node", "dist/scripts/start.js"]

# Alternative: Run specific script
# CMD ["node", "dist/scripts/start.js"]
