import { ethers } from 'ethers';
import connectDB from '../db.js';

function deterministicStringify(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export async function verifySignature(req, res, next) {
  const { timestamp, data, signature, address } = req.body;

  console.log('[verifySignature] Incoming signed request:', req.body);

  if (!timestamp || !data || !signature || !address) {
    console.warn('[verifySignature] Missing required fields');
    return res.status(400).json({ error: 'Missing fields in signed request' });
  }

  // Check timestamp freshness (5 minutes tolerance)
  const now = Date.now();
  const maxAge = 5 * 60 * 1000;
  if (Math.abs(now - timestamp) > maxAge) {
    console.warn(`[verifySignature] Timestamp out of range: now=${now}, timestamp=${timestamp}`);
    return res.status(400).json({ error: 'Timestamp too old or in the future' });
  }

  // Serialize and hash the payload (timestamp + data)
  const serialized = deterministicStringify({ timestamp, data });
  const signatureHash = ethers.keccak256(ethers.toUtf8Bytes(serialized));

  // Verify signature matches address
  let recovered;
  try {
    recovered = ethers.verifyMessage(signatureHash, signature);
  } catch (e) {
    console.warn('[verifySignature] Signature verification failed:', e.message);
    return res.status(400).json({ error: 'Invalid signature format' });
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    console.warn('[verifySignature] Signature does not match address:', { recovered, address });
    return res.status(401).json({ error: 'Signature does not match address' });
  }

  // Connect to DB
  const db = await connectDB();

  // Check if this signatureHash + signature already used → replay protection
  const existing = await db.collection('used_signatures').findOne({ signatureHash, signature });
  if (existing) {
    console.warn('[verifySignature] Replay attack detected: signature already used');
    return res.status(409).json({ error: 'Replay attack detected: signature already used' });
  }

  // Insert signature usage record
  await db.collection('used_signatures').insertOne({
    signatureHash,
    signature,
    timestamp: new Date(timestamp),
    address: address.toLowerCase()
  });

  console.log('[verifySignature] Signature verified and stored. Proceeding.');

  // Attach verified data to request for downstream routes
  req.verifiedAddress = recovered;
  req.verifiedData = data;
  req.signature = signature; // Also attach signature for storage in transaction documents

  next();
}

// Optional: cleanup function to delete old signature records (call this periodically or on startup)

export async function cleanupOldSignatures() {
  const db = await connectDB();
  const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
  const result = await db.collection('used_signatures').deleteMany({
    timestamp: { $lt: cutoff }
  });
  console.log(`[cleanupOldSignatures] Removed ${result.deletedCount} old signature records`);
}
