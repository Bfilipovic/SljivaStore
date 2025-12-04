#!/usr/bin/env node
// backend/scripts/dropAllDataExceptAdmins.js
/**
 * Drop all collections except 'admins' for testing
 * 
 * WARNING: This will delete all data except admin accounts!
 */

import connectDB from "../db.js";
import { logInfo, logError } from "../utils/logger.js";

async function dropAllDataExceptAdmins() {
  const db = await connectDB();

  logInfo("[dropAllDataExceptAdmins] Starting data cleanup...");
  logInfo("[dropAllDataExceptAdmins] WARNING: This will delete all data except admin accounts!");

  try {
    // Get all collection names
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    logInfo(`[dropAllDataExceptAdmins] Found ${collectionNames.length} collections:`, collectionNames);

    // Collections to preserve
    const preserveCollections = ["admins", "system_state"]; // Keep system_state for maintenance mode state
    
    // Drop each collection except the ones to preserve
    let dropped = 0;
    let preserved = 0;

    for (const collectionName of collectionNames) {
      if (preserveCollections.includes(collectionName)) {
        logInfo(`[dropAllDataExceptAdmins] Preserving collection: ${collectionName}`);
        preserved++;
      } else {
        logInfo(`[dropAllDataExceptAdmins] Dropping collection: ${collectionName}`);
        await db.collection(collectionName).drop();
        dropped++;
      }
    }

    logInfo(`[dropAllDataExceptAdmins] Summary:`);
    logInfo(`  - Dropped: ${dropped} collections`);
    logInfo(`  - Preserved: ${preserved} collections`);
    logInfo(`[dropAllDataExceptAdmins] Data cleanup complete!`);

  } catch (error) {
    // Ignore errors for collections that don't exist
    if (error.code === 26) {
      logInfo(`[dropAllDataExceptAdmins] Collection already dropped or doesn't exist`);
    } else {
      logError(`[dropAllDataExceptAdmins] Error:`, error);
      throw error;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  dropAllDataExceptAdmins()
    .then(() => {
      logInfo("[dropAllDataExceptAdmins] Done!");
      process.exit(0);
    })
    .catch((error) => {
      logError("[dropAllDataExceptAdmins] Fatal error:", error);
      process.exit(1);
    });
}

export { dropAllDataExceptAdmins };

