#!/usr/bin/env node

/**
 * Script to backfill availableQuantity for all listings that don't have it.
 * This fixes old listings created before the availableQuantity field was added.
 * 
 * Usage:
 *   Local: node backend/scripts/backfillAvailableQuantity.mjs
 *   Docker: docker exec -it nominstore-backend node backend/scripts/backfillAvailableQuantity.mjs
 */

import connectDB from "../db.js";
import { recalculateAvailableQuantity } from "../services/listingService.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file based on NODE_ENV (same as db.js)
// This ensures the script works in both local and Docker environments
const envFile = process.env.NODE_ENV === "production" 
  ? ".env.production" 
  : ".env.development";
dotenv.config({ path: path.join(__dirname, "..", envFile) });

async function backfillAvailableQuantity() {
  const db = await connectDB();
  const listingsCol = db.collection("listings");

  console.log("🔍 Finding listings without availableQuantity...\n");

  // Find all listings that don't have availableQuantity set
  const listingsWithoutAvailableQuantity = await listingsCol
    .find({
      $or: [
        { availableQuantity: { $exists: false } },
        { availableQuantity: null }
      ]
    })
    .toArray();

  if (listingsWithoutAvailableQuantity.length === 0) {
    console.log("✅ All listings already have availableQuantity set. Nothing to do.");
    return;
  }

  console.log(`Found ${listingsWithoutAvailableQuantity.length} listing(s) without availableQuantity\n`);

  let updated = 0;
  let errors = 0;
  const errorsList = [];

  for (const listing of listingsWithoutAvailableQuantity) {
    try {
      const listingId = listing._id;
      const listingIdStr = listingId.toString();
      
      console.log(`[${updated + errors + 1}/${listingsWithoutAvailableQuantity.length}] Processing listing ${listingIdStr}...`);
      
      // Recalculate availableQuantity
      const availableQty = await recalculateAvailableQuantity(listingId);
      
      console.log(`  ✅ Set availableQuantity = ${availableQty} (quantity = ${listing.quantity || 0})`);
      updated++;
    } catch (error) {
      console.error(`  ❌ Error processing listing ${listing._id}: ${error.message}`);
      errors++;
      errorsList.push({
        listingId: listing._id.toString(),
        error: error.message
      });
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("BACKFILL SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total listings processed: ${listingsWithoutAvailableQuantity.length}`);
  console.log(`✅ Successfully updated: ${updated}`);
  console.log(`❌ Errors: ${errors}`);

  if (errorsList.length > 0) {
    console.log("\nErrors:");
    errorsList.forEach(({ listingId, error }) => {
      console.log(`  - Listing ${listingId}: ${error}`);
    });
  }

  console.log("\n✅ Backfill complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillAvailableQuantity()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export { backfillAvailableQuantity };

