#!/bin/sh
# Docker entrypoint script to fix Arweave wallet file permissions
# This script runs as root initially to fix permissions, then switches to appuser

# Use environment variable if set, otherwise default to the project's wallet file
WALLET_FILE_NAME="${ARWEAVE_WALLET_FILE:-90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json}"
WALLET_FILE="/app/${WALLET_FILE_NAME}"
APPUSER="appuser"

# Debug: Log current user
echo "[docker-entrypoint] Running as user: $(id -u) ($(whoami))"

# Fix permissions on wallet file if it exists
# NOTE: For mounted files, ownership changes might not persist, but we try anyway
if [ -f "$WALLET_FILE" ]; then
  # Log current file permissions and ownership
  echo "[docker-entrypoint] Wallet file exists: $WALLET_FILE"
  ls -la "$WALLET_FILE" || true
  
  # Try to change ownership to appuser (if we're root)
  if [ "$(id -u)" = "0" ]; then
    echo "[docker-entrypoint] Attempting to fix wallet file permissions (running as root)..."
    
    # Change ownership first (this is what matters for mounted files)
    if chown appuser:appuser "$WALLET_FILE" 2>/dev/null; then
      echo "[docker-entrypoint] ✓ Changed ownership of wallet file to appuser"
    else
      echo "[docker-entrypoint] ✗ Failed to change ownership (file may be mounted read-only or have restrictive host permissions)"
    fi
    
    # Also try to set permissions
    if chmod 644 "$WALLET_FILE" 2>/dev/null; then
      echo "[docker-entrypoint] ✓ Set wallet file permissions to 644"
    else
      echo "[docker-entrypoint] ✗ Failed to change permissions"
    fi
    
    # Verify final state
    echo "[docker-entrypoint] Final wallet file state:"
    ls -la "$WALLET_FILE" || true
    
    # Test if appuser can read it
    if su-exec appuser test -r "$WALLET_FILE" 2>/dev/null; then
      echo "[docker-entrypoint] ✓ Wallet file is readable by appuser"
    else
      echo "[docker-entrypoint] ✗ WARNING: Wallet file is NOT readable by appuser!"
      echo "[docker-entrypoint]   This will cause Arweave upload failures."
      echo "[docker-entrypoint]   Fix on host: chmod 644 backend/$WALLET_FILE_NAME && chown 1000:1000 backend/$WALLET_FILE_NAME"
    fi
  else
    echo "[docker-entrypoint] ✗ WARNING: Not running as root, cannot fix wallet file permissions"
    echo "[docker-entrypoint]   Current user: $(id -u) ($(whoami))"
    echo "[docker-entrypoint]   Please fix on host:"
    echo "[docker-entrypoint]     chmod 644 backend/$WALLET_FILE_NAME"
    echo "[docker-entrypoint]     chown 1000:1000 backend/$WALLET_FILE_NAME"
  fi
else
  echo "[docker-entrypoint] ✗ WARNING: Arweave wallet file not found at $WALLET_FILE"
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

