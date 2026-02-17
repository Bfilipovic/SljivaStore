# Use Node 18 LTS
FROM node:18-slim

# Set working dir
WORKDIR /app

# Install dumb-init and build su-exec from source for proper signal handling and user switching
RUN apt-get update && \
    apt-get install -y dumb-init gcc make wget && \
    # Build su-exec from source (not available in Debian repos)
    cd /tmp && \
    wget -q https://github.com/ncopa/su-exec/archive/v0.2.tar.gz && \
    tar -xzf v0.2.tar.gz && \
    cd su-exec-0.2 && \
    make && \
    cp su-exec /usr/local/bin/ && \
    chmod +x /usr/local/bin/su-exec && \
    cd / && \
    rm -rf /tmp/su-exec-0.2 /tmp/v0.2.tar.gz && \
    apt-get remove -y gcc make wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy package files & install dependencies
# This layer is cached unless package files change
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
# This layer is cached unless source code changes
COPY . .

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create non-root user for security (idempotent - only create if doesn't exist)
RUN if ! id appuser >/dev/null 2>&1; then \
      useradd -m -u 1000 appuser 2>/dev/null || useradd -m appuser; \
    fi && \
    chown -R appuser:appuser /app && \
    chown appuser:appuser /docker-entrypoint.sh

# Note: We switch to appuser in the entrypoint script after fixing permissions
# This allows the script to run as root to fix file permissions, then switch to appuser

# Expose backend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script (which fixes permissions, switches to appuser, then calls dumb-init)
# Note: The entrypoint script must be executable and will run as root initially
ENTRYPOINT ["/docker-entrypoint.sh", "dumb-init", "--"]
CMD ["npm", "start"]
