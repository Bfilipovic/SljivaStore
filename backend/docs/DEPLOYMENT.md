# Deployment Guide

## Overview

This guide covers deploying the Nomin backend with all its features, including Arweave integration.

## Prerequisites

- Docker and Docker Compose installed on the server
- Access to the server via SSH
- Arweave wallet keyfile (NOT in git - must be transferred securely)
- Environment variables configured

## Deployment Steps

### 1. Prepare the Server

Clone the repository on your server:

```bash
git clone https://github.com/Bfilipovic/Nomin.git
cd Nomin
git submodule update --init --recursive
```

### 2. Transfer the Arweave Keyfile Securely

The Arweave keyfile (`90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`) is NOT in git for security reasons. You need to transfer it manually:

**Option A: Using SCP (Recommended)**

From your local machine:

```bash
scp backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json user@your-server:/path/to/Nomin/backend/
```

**Option B: Using SFTP**

Connect via SFTP and upload the file to `backend/` directory.

**Option C: Manual Copy**

1. Create the file on the server manually
2. Copy the contents from your local file
3. Save it to `backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`

### 3. Set Up Environment Files

Create `backend/.env.production` with your production configuration:

```bash
cd backend
cp .env.example .env.production  # If you have an example file
# Or create it manually
```

Required environment variables:
- `MONGO_URL` (if not using docker-compose, defaults to `mongodb://mongo:27017`)
- `MONGO_DB` (defaults to `nftstore`)
- `NODE_ENV=production`
- `ARWEAVE_GATEWAY` (optional, defaults to `https://arweave.net`)

### 4. Configure Docker Compose

The `docker-compose.yml` is already configured to:
- Mount the Arweave keyfile as a volume (so it's not baked into the image)
- Use environment files from `backend/.env.production` and `frontend/.env.production`

**Important:** The Arweave keyfile must be placed at `backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json` on the server BEFORE building/running containers.

### 5. Build and Start Services

```bash
docker-compose build
docker-compose up -d
```

### 6. Verify Deployment

Check that all containers are running:

```bash
docker-compose ps
```

Check backend logs:

```bash
docker-compose logs backend
```

You should see:
- MongoDB connection successful
- Arweave initialized (if keyfile is found)
- Server listening on port 3000

### 7. Start Background Workers

The Arweave retry worker runs automatically when the backend starts (configured in `backend/server.js`).

To verify it's running:

```bash
docker-compose logs backend | grep ArweaveRetryWorker
```

## Security Considerations

### Arweave Keyfile

- ✅ **NEVER commit the keyfile to git** (already in `.gitignore`)
- ✅ **Use secure transfer methods** (SCP, SFTP) to copy to server
- ✅ **Set appropriate file permissions** on the server:
  ```bash
  chmod 600 backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json
  ```
- ✅ **Backup the keyfile securely** (use encrypted storage, password manager, etc.)
- ✅ **The keyfile is mounted as a volume** in docker-compose, not baked into the image

### Environment Variables

- ✅ **Never commit `.env.production` to git** (already in `.gitignore`)
- ✅ **Use strong secrets** for any API keys or tokens
- ✅ **Restrict file permissions**:
  ```bash
  chmod 600 backend/.env.production
  chmod 600 frontend/.env.production
  ```

## Maintenance

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Updating the Application

```bash
# Pull latest changes
git pull origin main
cd explorer && git pull origin main && cd ..

# Rebuild and restart
docker-compose build
docker-compose up -d

# Or restart specific service
docker-compose restart backend
```

### Checking Arweave Queue Status

Check maintenance mode and queue status:

```bash
curl http://localhost/api/status/maintenance
```

## Troubleshooting

### Arweave Keyfile Not Found

**Error:** `Arweave keyfile not found at: ...`

**Solution:**
1. Verify the file exists: `ls -la backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`
2. Check file permissions: `chmod 644 backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`
3. Ensure the file is in the correct location relative to the backend directory

### Insufficient Arweave Balance

**Error:** `Failed to upload to Arweave: 400 - Transaction verification failed`

**Solution:**
1. Check Arweave wallet balance
2. Add AR tokens to the wallet address
3. Verify wallet address matches the keyfile

### Maintenance Mode Activated

If maintenance mode is enabled due to Arweave upload failures:

1. Check Arweave queue status: `GET /api/status/maintenance`
2. Fix the underlying issue (usually insufficient AR balance)
3. The retry worker will automatically process the queue
4. Maintenance mode will exit automatically when all uploads succeed

## Backup Recommendations

1. **Arweave Keyfile**: Store in encrypted backup (password manager, encrypted USB drive)
2. **Database**: Regular MongoDB backups using `mongodump`
3. **Environment Files**: Store securely (encrypted, password manager)

## Additional Resources

- [Arweave Integration Documentation](./ARWEAVE_INTEGRATION.md)
- [Arweave Queue System](./ARWEAVE_QUEUE_SYSTEM.md)
- [Arweave Troubleshooting](./ARWEAVE_FAILURE_REASONS.md)

