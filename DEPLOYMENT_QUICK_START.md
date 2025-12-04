# Deployment Quick Start Guide

## Overview

This is a quick reference for deploying Nomin to production. For detailed information, see `backend/docs/DEPLOYMENT.md`.

## Prerequisites

- Docker and Docker Compose installed
- SSH access to your server
- Arweave wallet keyfile (NOT in git)

## Quick Deployment Steps

### 1. Clone Repository

```bash
git clone https://github.com/Bfilipovic/Nomin.git
cd Nomin
git submodule update --init --recursive
```

### 2. Transfer Arweave Keyfile (IMPORTANT!)

The Arweave keyfile is **NOT in git** for security. You must transfer it manually:

```bash
# From your local machine:
scp backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json user@your-server:/path/to/Nomin/backend/

# On the server, set secure permissions:
chmod 600 backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json
```

**⚠️ CRITICAL:** Without this file, Arweave uploads will fail!

### 3. Set Up Environment Files

Create production environment files:

```bash
# Backend
cd backend
# Create .env.production with your settings
# Required: MONGO_URL, MONGO_DB, NODE_ENV=production

# Frontend  
cd ../frontend
# Create .env.production with your settings
```

### 4. Deploy

**Option A: Using the deployment script**

```bash
cd /path/to/Nomin
./scripts/deploy.sh
```

**Option B: Manual deployment**

```bash
docker-compose build
docker-compose up -d
```

### 5. Verify

```bash
# Check service status
docker-compose ps

# Check backend logs
docker-compose logs backend

# Look for these in logs:
# - "Arweave initialized"
# - "ArweaveRetryWorker] Starting..."
# - Server listening on port 3000
```

## Keyfile Security

- ✅ **NEVER commit to git** (already in `.gitignore`)
- ✅ **Transfer securely** using SCP/SFTP
- ✅ **Set permissions**: `chmod 600 backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`
- ✅ **Backup securely** (encrypted storage, password manager)
- ✅ **Mounted as volume** in Docker (not baked into image)

## File Locations

### On Server:
```
Nomin/
├── backend/
│   ├── 90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json  ← Must be here!
│   └── .env.production
├── frontend/
│   └── .env.production
└── docker-compose.yml
```

### In Docker Container:
The keyfile is mounted at `/app/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json` inside the backend container.

## Troubleshooting

### Arweave Keyfile Not Found

**Error:** `Arweave keyfile not found at: ...`

**Fix:**
1. Verify file exists: `ls -la backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`
2. Check it's at the correct path
3. Restart container: `docker-compose restart backend`

### Check Maintenance Status

```bash
curl http://localhost/api/status/maintenance
```

## Additional Resources

- Full deployment guide: `backend/docs/DEPLOYMENT.md`
- Arweave integration: `backend/docs/ARWEAVE_INTEGRATION.md`
- Troubleshooting: `backend/docs/ARWEAVE_TROUBLESHOOTING.md`

