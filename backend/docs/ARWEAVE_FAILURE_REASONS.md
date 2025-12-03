# Possible Reasons for Arweave Upload Failures

## 1. **Insufficient AR Balance** ⚠️ (Most Common)

**Problem**: The Arweave wallet doesn't have enough AR tokens to pay for transaction fees.

**Symptoms**:
- Error: `"Failed to upload to Arweave: 400 - Transaction verification failed"`
- Log shows: `"Balance may be insufficient"`

**Why it happens**:
- AR (Arweave's native token) is required to pay for permanent storage
- Each transaction costs a small amount of AR (typically 0.0001-0.001 AR)
- If the balance is exhausted, uploads will fail

**Solution**:
- Check balance: Use `backend/scripts/testArweaveUpload.js` or check logs
- Fund wallet: Send AR to the wallet address
- Recommended minimum: 0.01 AR for multiple transactions

---

## 2. **Network/Connectivity Issues** 🌐

**Problem**: Cannot reach the Arweave gateway.

**Symptoms**:
- Timeout errors
- Connection refused errors
- Network errors in logs

**Why it happens**:
- Internet connectivity problems
- Arweave gateway is down or unreachable
- Firewall blocking connections
- DNS resolution failures

**Solution**:
- Check internet connection
- Verify gateway is accessible: `curl https://arweave.net/`
- Try different gateway via `ARWEAVE_GATEWAY` env var
- Check firewall/network settings

---

## 3. **Invalid Wallet/Keyfile** 🔑

**Problem**: The Arweave wallet keyfile is missing, corrupted, or invalid.

**Symptoms**:
- Error: `"Arweave keyfile not found"`
- Error: `"Invalid wallet"` or signature errors
- JSON parsing errors

**Why it happens**:
- Keyfile deleted or moved
- File corrupted
- Invalid JSON format
- Wrong file permissions

**Solution**:
- Verify keyfile exists at: `backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`
- Check file permissions (readable by Node.js)
- Validate JSON format
- Restore from backup if corrupted

---

## 4. **Transaction Size Too Large** 📦

**Problem**: Transaction data exceeds Arweave's size limits.

**Symptoms**:
- Errors about transaction size
- Upload failures for large transactions

**Why it happens**:
- Arweave has maximum transaction size limits
- Very large JSON payloads may exceed limits
- Tags add overhead

**Solution**:
- Check transaction data size in logs
- Reduce transaction data if possible
- Split very large transactions if needed

---

## 5. **Transaction Verification Failure** ✋

**Problem**: Arweave rejects the transaction during verification.

**Symptoms**:
- Error: `"Transaction verification failed"` (400 error)
- Transaction fails before posting

**Why it happens**:
- Invalid transaction structure
- Malformed data
- Invalid tags
- Transaction doesn't meet Arweave protocol requirements
- Signature validation fails

**Solution**:
- Check transaction data structure
- Verify all required fields are present
- Ensure data can be JSON.stringify'd properly
- Check transaction tags are valid

---

## 6. **Gateway Rate Limiting** ⏱️

**Problem**: Arweave gateway rate-limits requests.

**Symptoms**:
- HTTP 429 (Too Many Requests)
- Temporary failures that work after delay

**Why it happens**:
- Too many uploads in short time
- Gateway implements rate limiting
- High system load

**Solution**:
- Add delays between uploads
- Implement retry logic with exponential backoff
- Use different gateway if available

---

## 7. **Invalid Data Format** 📝

**Problem**: Transaction data cannot be serialized or contains invalid values.

**Symptoms**:
- JSON.stringify errors
- Serialization failures
- Invalid field errors

**Why it happens**:
- Circular references in data
- Functions or non-serializable objects
- Invalid Date objects
- MongoDB ObjectId objects not converted

**Solution**:
- Ensure all data is JSON-serializable
- Convert Dates to ISO strings
- Convert ObjectIds to strings
- Remove circular references

---

## 8. **Previous Transaction Link Issue** 🔗

**Problem**: The `previous_arweave_tx` reference points to invalid/non-existent transaction.

**Symptoms**:
- Errors about invalid previous transaction
- Chain verification failures

**Why it happens**:
- Previous transaction was never confirmed
- Invalid transaction ID format
- Transaction doesn't exist on Arweave

**Solution**:
- Verify previous transaction exists on Arweave
- Check transaction ID format
- Handle null previous transaction correctly

---

## 9. **Concurrent Transaction Conflicts** ⚡

**Problem**: Multiple transactions being uploaded simultaneously cause conflicts.

**Symptoms**:
- Race conditions
- Transaction number conflicts
- Duplicate transaction issues

**Why it happens**:
- High concurrency
- Multiple processes uploading simultaneously
- Transaction numbering conflicts

**Solution**:
- Atomic transaction numbering (already implemented)
- Queue uploads if needed
- Retry failed uploads sequentially

---

## 10. **Arweave Network Issues** 🚨

**Problem**: Arweave network is experiencing downtime or issues.

**Symptoms**:
- Gateway returns errors
- Network timeouts
- Service unavailable errors

**Why it happens**:
- Arweave network maintenance
- Gateway outages
- Network congestion

**Solution**:
- Check Arweave network status
- Wait and retry later
- Use alternative gateway
- Monitor Arweave status pages

---

## 11. **Invalid Transaction Tags** 🏷️

**Problem**: Tags added to transaction are invalid or malformed.

**Symptoms**:
- Tag-related errors
- Transaction rejection

**Why it happens**:
- Invalid tag format
- Tag values too long
- Invalid characters in tags

**Solution**:
- Verify tag format and length
- Ensure tags meet Arweave requirements
- Check tag encoding

---

## 12. **Database/Transaction Number Issues** 🔢

**Problem**: Issues with transaction number or database state.

**Symptoms**:
- Transaction number conflicts
- Database connection errors
- Counter initialization issues

**Why it happens**:
- Database unavailable
- Counter collection issues
- Race conditions in numbering

**Solution**:
- Verify database connectivity
- Check counter collection state
- Ensure atomic operations work correctly

---

## 13. **Environment Configuration** ⚙️

**Problem**: Wrong Arweave gateway or environment configuration.

**Symptoms**:
- Connecting to wrong network
- Testnet vs mainnet mismatches

**Why it happens**:
- `ARWEAVE_GATEWAY` env var pointing to wrong endpoint
- Testnet vs mainnet confusion
- Wrong network configuration

**Solution**:
- Verify `ARWEAVE_GATEWAY` environment variable
- Check if using testnet vs mainnet
- Ensure wallet matches network

---

## 14. **Transaction Already Exists** 🔄

**Problem**: Trying to upload a duplicate transaction.

**Symptoms**:
- Error about duplicate transaction
- Transaction already exists on Arweave

**Why it happens**:
- Retry logic creates duplicates
- Same transaction uploaded multiple times
- Transaction ID collision

**Solution**:
- Check if transaction already exists before uploading
- Implement idempotency checks
- Handle duplicate uploads gracefully

---

## How to Diagnose

1. **Check Logs**: Look for detailed error messages in backend logs
2. **Run Test Script**: Use `backend/scripts/testArweaveUpload.js`
3. **Check Balance**: Verify wallet has sufficient AR
4. **Verify Network**: Test connectivity to Arweave gateway
5. **Check Transaction Data**: Ensure data is valid and serializable

## Current Error Handling

The system is designed to be resilient:
- ✅ Transactions are saved to MongoDB even if Arweave upload fails
- ✅ Warning is logged but processing continues
- ✅ Failed uploads can be retried using `backend/scripts/retryArweaveUploads.js`
- ✅ `arweaveTxId` is optional in the database

This ensures system availability even when Arweave is temporarily unavailable.

