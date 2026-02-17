#!/bin/sh
# Docker entrypoint script to fix Arweave wallet file permissions
# This script runs as root initially to fix permissions, then switches to appuser

# Use environment variable if set, otherwise default to the project's wallet file
WALLET_FILE_NAME="${ARWEAVE_WALLET_FILE:-90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json}"
WALLET_FILE="/app/${WALLET_FILE_NAME}"
APPUSER="appuser"

# Fix permissions on wallet file if it exists
# This runs as root (before USER directive takes effect)
if [ -f "$WALLET_FILE" ]; then
  # Make file readable by all (644 = rw-r--r--)
  # This allows appuser (UID 1000) to read it even if mounted from host
  if chmod 644 "$WALLET_FILE" 2>/dev/null; then
    echo "[docker-entrypoint] Fixed permissions on Arweave wallet file"
  else
    echo "[docker-entrypoint] Warning: Could not change permissions on wallet file (may already be correct or mounted read-only)"
  fi
else
  echo "[docker-entrypoint] Warning: Arweave wallet file not found at $WALLET_FILE"
fi

# Switch to appuser if we're running as root
# This ensures the application runs as non-root user
if [ "$(id -u)" = "0" ]; then
  # Check if appuser exists
  if id "$APPUSER" >/dev/null 2>&1; then
    echo "[docker-entrypoint] Switching to user: $APPUSER"
    # Use su-exec (lightweight) to switch user and execute command
    exec su-exec "$APPUSER" "$@"
  else
    echo "[docker-entrypoint] Warning: User $APPUSER not found, running as root"
    exec "$@"
  fi
else
  # Already running as appuser, execute directly
  exec "$@"
fi

