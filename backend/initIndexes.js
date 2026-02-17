// backend/initIndexes.js
/**
 * Script: Initialize MongoDB indexes for performance
 *
 * Ensures the following indexes exist:
 * - parts.parent_hash                → "all parts of NFT X"
 * - parts.owner                      → "all parts owned by address Y"
 * - parts.listing                    → "all parts currently in listing Z"
 * - parts.parent_hash + owner        → "all parts of NFT X owned by Y"
 * - reservations.listingId           → lookups by listing (cleanup, tx finalize)
 * - partialtransactions.part         → transaction history for a part
 *
 * Usage:
 *   node initIndexes.js
 *
 * Or import into server.js and call `initIndexes()` once at startup.
 */

import connectDB from "./db.js";

export async function initIndexes() {
  const db = await connectDB();

  // Parts collection
  await db.collection("parts").createIndex({ parent_hash: 1 });
  await db.collection("parts").createIndex({ owner: 1 });
  await db.collection("parts").createIndex({ listing: 1 });
  await db.collection("parts").createIndex({ reservation: 1 }); // For atomic reservation locking
  await db.collection("parts").createIndex({ parent_hash: 1, owner: 1 }); // compound

  // Reservations collection
  await db.collection("reservations").createIndex({ listingId: 1 });
  await db.collection("reservations").createIndex({ reserver: 1, timestamp: 1 }); // For checking existing reservations

  // Partial transactions collection
  await db.collection("partialtransactions").createIndex({ part: 1 });

  // Profiles collection
  await db.collection("profiles").createIndex({ address: 1 }, { unique: true });
  await db.collection("profiles").createIndex({ username: 1 }, { unique: true });

  // Uploads collection
  await db.collection("uploads").createIndex({ uploader: 1 });
  await db.collection("uploads").createIndex({ status: 1 });
  await db.collection("uploads").createIndex({ time_created: -1 });

  // Listings collection - CRITICAL for store page performance
  await db.collection("listings").createIndex({ status: 1 });
  await db.collection("listings").createIndex({ time_created: -1 });
  await db.collection("listings").createIndex({ seller: 1 });
  // Compound index for getActiveListings() - store page
  await db.collection("listings").createIndex({ status: 1, time_created: -1 });
  // Compound index for getUserListings() - user's listings page
  await db.collection("listings").createIndex({ seller: 1, status: 1, time_created: -1 });

  // Transactions collection - CRITICAL for transaction lookups and creation
  await db.collection("transactions").createIndex({ transaction_number: 1 });
  await db.collection("transactions").createIndex({ timestamp: -1 });
  await db.collection("transactions").createIndex({ chainTx: 1 });
  await db.collection("transactions").createIndex({ arweaveTxId: 1 });
  await db.collection("transactions").createIndex({ type: 1 });
  await db.collection("transactions").createIndex({ buyer: 1 });
  await db.collection("transactions").createIndex({ seller: 1 });
  await db.collection("transactions").createIndex({ giver: 1 });
  await db.collection("transactions").createIndex({ receiver: 1 });
  // Compound index for getNextTransactionInfo() - finds previous Arweave transaction
  await db.collection("transactions").createIndex({ transaction_number: -1, arweaveTxId: 1 });
  // Compound indexes for getTransactionsByUser() - user transaction history
  await db.collection("transactions").createIndex({ type: 1, buyer: 1, timestamp: -1 });
  await db.collection("transactions").createIndex({ type: 1, seller: 1, timestamp: -1 });
  await db.collection("transactions").createIndex({ type: 1, giver: 1, timestamp: -1 });
  await db.collection("transactions").createIndex({ type: 1, receiver: 1, timestamp: -1 });

  // Partial transactions collection
  await db.collection("partialtransactions").createIndex({ transaction: 1 });
  await db.collection("partialtransactions").createIndex({ chainTx: 1 });
  await db.collection("partialtransactions").createIndex({ timestamp: -1 });
  // Compound index for getPartialTransactionsByTransactionId() with sorting
  await db.collection("partialtransactions").createIndex({ transaction: 1, timestamp: -1 });

  // Profiles collection - CRITICAL for photographers page
  await db.collection("profiles").createIndex({ status: 1 });
  // Compound index for getVerifiedPhotographers() - photographers page with search
  await db.collection("profiles").createIndex({ status: 1, username: 1 });

  // NFTs collection - for lookups by creator
  await db.collection("nfts").createIndex({ creator: 1 });
  await db.collection("nfts").createIndex({ time_created: -1 });

  console.log("[initIndexes] Indexes ensured successfully");
}

// Run directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  initIndexes()
    .then(() => {
      console.log("[initIndexes] Done");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[initIndexes] Error:", err);
      process.exit(1);
    });
}
