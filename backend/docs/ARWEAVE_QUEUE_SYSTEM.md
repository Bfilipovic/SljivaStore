# Arweave Queue and Maintenance Mode System

## Overview

This document describes the system for handling Arweave upload failures, queuing failed transactions, and implementing maintenance mode to prevent data loss.

## Problem Statement

When Arweave uploads fail (e.g., insufficient AR balance, network issues), transactions are still saved to MongoDB but not uploaded to Arweave. If the system continues operating normally, users may perform paid transactions that fail to upload, resulting in data loss.

## Solution Architecture

### 1. **Queue System** (`backend/services/arweaveQueueService.js`)

When an Arweave upload fails:
- The failed transaction is queued in the `arweave_upload_queue` collection
- Queue item includes:
  - Full transaction data
  - Transaction number
  - Previous Arweave transaction ID
  - Error details
  - Retry count
  - Timestamp

### 2. **Maintenance Mode Detection**

After `FAILURES_BEFORE_MAINTENANCE` (default: 3) consecutive failures within 10 minutes:
- System automatically enters maintenance mode
- State-changing operations are blocked
- Users see maintenance message instead of errors

### 3. **Background Retry Worker** (`backend/scripts/arweaveRetryWorker.js`)

- Runs every 60 seconds
- Processes queued transactions in batches (default: 5 per cycle)
- Uses stored transaction numbers (doesn't increment counter)
- Updates previous transaction ID if newer transactions succeeded
- Automatically exits maintenance mode when all queued items are processed

### 4. **Maintenance Mode Middleware** (`backend/utils/checkMaintenanceMode.js`)

- Blocks all state-changing operations when maintenance mode is active
- Returns 503 Service Unavailable with maintenance details
- Applied to routes:
  - `POST /api/listings`
  - `DELETE /api/listings/:id`
  - `POST /api/transactions`
  - `POST /api/gifts`
  - `POST /api/gifts/claim`
  - `POST /api/gifts/refuse`
  - `POST /api/gifts/cancel`
  - `POST /api/nfts/mint`

### 5. **Frontend Integration** (`frontend/src/lib/maintenance.ts`)

- Checks maintenance status before state-changing operations
- Displays maintenance message to users
- Handles 503 errors gracefully
- Caches maintenance status (5 seconds) to reduce API calls

## Database Collections

### `arweave_upload_queue`

```javascript
{
  _id: "transactionId", // Transaction hash
  transactionData: { /* full transaction object */ },
  transactionNumber: 123,
  previousArweaveTxId: "arweave_tx_id_or_null",
  error: "Error message",
  errorStack: "Stack trace",
  queuedAt: ISODate(),
  retryCount: 0,
  status: "PENDING" | "SUCCESS",
  arweaveTxId: "arweave_tx_id" // Set on success
}
```

### `system_state`

```javascript
{
  _id: "arweave_maintenance_mode",
  enabled: true,
  reason: "Multiple Arweave upload failures detected",
  updatedAt: ISODate()
}
```

## API Endpoints

### `GET /api/status/maintenance`

Returns maintenance mode status:

```json
{
  "maintenanceMode": true,
  "reason": "Multiple Arweave upload failures detected",
  "updatedAt": "2025-12-02T12:00:00.000Z",
  "pendingUploads": 5
}
```

## Flow Diagrams

### Normal Operation (Upload Succeeds)

```
1. User creates transaction
2. Transaction saved to MongoDB
3. Upload to Arweave → SUCCESS
4. Transaction marked with arweaveTxId
```

### Upload Failure (Queue & Continue)

```
1. User creates transaction
2. Transaction saved to MongoDB
3. Upload to Arweave → FAILURE
4. Transaction queued for retry
5. User sees success (transaction is in DB)
```

### Multiple Failures (Enter Maintenance)

```
1. Multiple uploads fail
2. Queue fills up (3+ failures in 10 minutes)
3. System enters maintenance mode
4. New state-changing operations blocked
5. Background worker retries queued items
```

### Recovery (Exit Maintenance)

```
1. Background worker processes queue
2. All queued items successfully uploaded
3. System automatically exits maintenance mode
4. Normal operations resume
```

## Key Features

### ✅ **No Data Loss**

- All transactions are saved to MongoDB before Arweave upload
- Failed uploads are queued and retried
- Users' paid transactions are never lost

### ✅ **Automatic Recovery**

- Background worker continuously retries failed uploads
- System automatically exits maintenance mode when uploads succeed
- No manual intervention required

### ✅ **User-Friendly**

- Clear maintenance messages
- Transactions still succeed from user's perspective (saved to DB)
- Arweave upload happens asynchronously

### ✅ **Resilient**

- Handles network issues, insufficient balance, etc.
- Queue persists across server restarts
- Retry logic with exponential backoff

## Configuration

### Environment Variables

None required - uses existing Arweave configuration.

### Tuning Parameters

In `backend/services/arweaveQueueService.js`:
- `FAILURES_BEFORE_MAINTENANCE`: Number of failures before entering maintenance (default: 3)
- Failure window: 10 minutes

In `backend/scripts/arweaveRetryWorker.js`:
- `RETRY_INTERVAL_MS`: How often to retry (default: 60 seconds)
- `BATCH_SIZE`: Items to process per cycle (default: 5)

## Monitoring

Check maintenance status:
```bash
curl http://localhost:3000/api/status/maintenance
```

Check queue size:
```javascript
// In MongoDB
db.arweave_upload_queue.countDocuments({ status: "PENDING" })
```

View queued items:
```javascript
db.arweave_upload_queue.find({ status: "PENDING" }).sort({ queuedAt: 1 })
```

## Manual Overrides

### Force Exit Maintenance Mode

```javascript
// In MongoDB
db.system_state.updateOne(
  { _id: "arweave_maintenance_mode" },
  { $set: { enabled: false, reason: "Manual override", updatedAt: new Date() } }
)
```

### Clear Queue (use with caution)

```javascript
// Only if you're sure these transactions are handled elsewhere
db.arweave_upload_queue.deleteMany({ status: "PENDING" })
```

## Troubleshooting

### Maintenance Mode Stuck On

1. Check if queue has pending items: `db.arweave_upload_queue.find({ status: "PENDING" })`
2. Check retry worker logs for errors
3. Verify Arweave wallet has sufficient balance
4. Manually exit maintenance mode if needed (see above)

### Transactions Not Uploading

1. Check Arweave wallet balance
2. Check network connectivity to Arweave gateway
3. Review error messages in queue items
4. Check retry worker is running (should start automatically with server)

### Queue Growing Too Large

1. Increase `BATCH_SIZE` in retry worker
2. Decrease `RETRY_INTERVAL_MS` for faster processing
3. Check why uploads are failing (balance, network, etc.)

## Implementation Files

- `backend/services/arweaveQueueService.js` - Queue management
- `backend/services/arweaveService.js` - Upload logic with queue integration
- `backend/utils/checkMaintenanceMode.js` - Maintenance mode middleware
- `backend/scripts/arweaveRetryWorker.js` - Background retry worker
- `backend/routes/status.js` - Maintenance status API
- `frontend/src/lib/maintenance.ts` - Frontend maintenance utilities

## Related Documentation

- `ARWEAVE_INTEGRATION.md` - Arweave integration details
- `ARWEAVE_FAILURE_REASONS.md` - Common failure reasons
- `ARWEAVE_TROUBLESHOOTING.md` - Troubleshooting guide

