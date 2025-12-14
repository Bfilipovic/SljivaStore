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
