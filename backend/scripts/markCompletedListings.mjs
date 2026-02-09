#!/usr/bin/env node

/**
 * Script to mark existing listings as COMPLETED if they meet the criteria:
 * - All parts have been sold (no parts left with listing=listingId)
 * - No active reservations exist for this listing
 */

import connectDB from "../db.js";
import { ObjectId } from "mongodb";

async function markCompletedListings() {
  const db = await connectDB();
  const listingsCol = db.collection("listings");
  const partsCol = db.collection("parts");
  const reservationsCol = db.collection("reservations");

  console.log("🔍 Finding listings that should be marked as COMPLETED...\n");

  // Get all ACTIVE listings (not already CANCELED or COMPLETED)
  const activeListings = await listingsCol
    .find({
      status: { $nin: ["CANCELED", "COMPLETED"] }
    })
    .toArray();

  console.log(`Found ${activeListings.length} active listings to check\n`);

  let updatedCount = 0;
  const now = new Date();

  for (const listing of activeListings) {
    const listingIdStr = listing._id.toString();

    // Check if there are any parts still locked to this listing
    const remainingPartsCount = await partsCol.countDocuments({
      listing: listingIdStr,
    });

    // Check if there are any active reservations for this listing
    const activeReservationsCount = await reservationsCol.countDocuments({
      listingId: listingIdStr,
    });

    // If no parts remain and no active reservations, mark as COMPLETED
    if (remainingPartsCount === 0 && activeReservationsCount === 0) {
      await listingsCol.updateOne(
        { _id: listing._id },
        {
          $set: {
            status: "COMPLETED",
            time_completed: now,
            time_updated: now,
          }
        }
      );

      updatedCount++;
      console.log(`✅ Marked listing ${listingIdStr} as COMPLETED`);
      console.log(`   NFT: ${listing.nftId}, Seller: ${listing.seller}, Quantity: ${listing.quantity}`);
    } else {
      console.log(`⏭️  Skipping listing ${listingIdStr} (${remainingPartsCount} parts remaining, ${activeReservationsCount} reservations)`);
    }
  }

  console.log(`\n📊 Summary: Updated ${updatedCount} listing(s) to COMPLETED status`);
  return updatedCount;
}

// Run the script
markCompletedListings()
  .then((count) => {
    console.log(`\n✅ Script completed successfully. ${count} listing(s) updated.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error running script:", error);
    process.exit(1);
  });

