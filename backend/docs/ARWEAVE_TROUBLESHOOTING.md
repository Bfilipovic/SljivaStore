# Arweave Troubleshooting Guide

## Common Issues

### 1. "Transaction verification failed" (400 Error)

This error typically occurs when:

#### A. Insufficient AR Balance
- **Problem**: The Arweave wallet doesn't have enough AR (Arweave's native token) to pay for transaction fees.
- **Solution**: Fund your Arweave wallet with AR. You can check your balance using:
  ```javascript
  const address = await arweave.wallets.jwkToAddress(wallet);
  const balance = await arweave.wallets.getBalance(address);
  const balanceInAR = arweave.ar.winstonToAr(balance);
  console.log(`Balance: ${balanceInAR} AR`);
  ```
- **Minimum Required**: Typically ~0.001 AR per transaction (varies based on data size)

#### B. Invalid Transaction Structure
- **Problem**: The transaction data contains invalid fields or cannot be serialized.
- **Solution**: Ensure all transaction data can be JSON.stringify'd properly. MongoDB-specific fields like `_id` are automatically excluded.

#### C. Invalid Wallet/Signature
- **Problem**: The wallet keyfile is corrupted or invalid.
- **Solution**: Verify the wallet keyfile is valid JSON and can be loaded by Arweave SDK.

## Checking Wallet Balance

You can check your wallet balance using the test script:

```bash
cd backend
node scripts/testArweaveUpload.js
```

This will show:
- Wallet address
- Current AR balance
- Estimated transaction cost
- Whether balance is sufficient

## Funding Your Wallet

To fund your Arweave wallet:

1. Get your wallet address:
   - Use the test script or check logs for the wallet address
   - Or extract it programmatically: `await arweave.wallets.jwkToAddress(wallet)`

2. Send AR to that address:
   - Use an Arweave wallet app (like ArConnect)
   - Or use an exchange that supports AR
   - Minimum recommended: 0.01 AR for multiple transactions

## Testing the Upload

Use the test script to manually test an upload:

```bash
cd backend
node scripts/testArweaveUpload.js
```

This will:
- Connect to database
- Get next transaction number
- Create a test transaction
- Attempt to upload to Arweave
- Show detailed error messages

## Error Messages Explained

- **"Insufficient AR balance"**: Wallet needs more AR tokens
- **"Transaction verification failed"**: Usually means insufficient balance or invalid transaction
- **"Failed to upload to Arweave: 400"**: HTTP 400 error from Arweave gateway

## Notes

- Transactions require AR to pay for storage fees
- Fees are very small (typically 0.0001-0.001 AR per transaction)
- You can use Arweave testnet for development/testing
- Set `ARWEAVE_GATEWAY` environment variable to use a different gateway

