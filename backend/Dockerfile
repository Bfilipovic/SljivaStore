# Use Node 18 LTS
FROM node:18-slim

# Set working dir
WORKDIR /app

# Install dumb-init for proper signal handling in containers
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Copy package files & install dependencies
# This layer is cached unless package files change
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
# This layer is cached unless source code changes
COPY . .

# Create non-root user for security (idempotent - only create if doesn't exist)
RUN if ! id appuser >/dev/null 2>&1; then \
      useradd -m -u 1000 appuser 2>/dev/null || useradd -m appuser; \
    fi && \
    chown -R appuser:appuser /app
USER appuser

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly (SIGTERM, etc.)
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
