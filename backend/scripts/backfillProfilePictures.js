// backend/scripts/backfillProfilePictures.js
/**
 * Script: Backfill profile pictures for existing users
 * 
 * Finds all confirmed profiles that don't have a profilepicture field
 * and sets it to the first uploaded image URL from their first UPLOAD transaction.
 * 
 * Usage:
 *   node backend/scripts/backfillProfilePictures.js
 */

import connectDB from "../db.js";
import { TX_TYPES } from "../utils/transactionTypes.js";
import { PROFILE_STATUS } from "../utils/statusConstants.js";
import { normalizeAddress } from "../utils/addressUtils.js";

async function backfillProfilePictures() {
  const db = await connectDB();
  const profilesCol = db.collection("profiles");
  const txCollection = db.collection("transactions");
  
  console.log("[backfillProfilePictures] Starting backfill...");
  
  // Find all confirmed profiles without profilepicture
  const profilesWithoutPicture = await profilesCol
    .find({
      status: PROFILE_STATUS.CONFIRMED,
      $or: [
        { profilepicture: { $exists: false } },
        { profilepicture: null }
      ]
    })
    .toArray();
  
  console.log(`[backfillProfilePictures] Found ${profilesWithoutPicture.length} profiles without profile pictures`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const profile of profilesWithoutPicture) {
    try {
      const address = normalizeAddress(profile.address);
      
      // Find the first upload for this user
      // Method 1: Check uploads collection (most reliable - has imageUrl directly)
      const uploadsCol = db.collection("uploads");
      const firstUpload = await uploadsCol.findOne(
        {
          uploader: address,
          status: "CONFIRMED"
        },
        { sort: { time_created: 1 } }
      );
      
      let imageUrl = null;
      
      if (firstUpload && firstUpload.imageUrl) {
        // Use imageUrl from upload document (stored when upload was accepted)
        imageUrl = firstUpload.imageUrl;
      } else if (firstUpload) {
        // Fallback: Find the transaction for this upload
        const uploadTx = await txCollection.findOne({
          type: TX_TYPES.UPLOAD,
          uploadId: firstUpload._id.toString()
        });
        
        if (uploadTx && uploadTx.uploadedimageurl) {
          imageUrl = uploadTx.uploadedimageurl;
        }
      }
      
      if (!imageUrl) {
        console.log(`[backfillProfilePictures] No upload found for ${profile.username} (${address})`);
        skipped++;
        continue;
      }
      
      // Update profile with profile picture
      await profilesCol.updateOne(
        { _id: profile._id },
        {
          $set: {
            profilepicture: imageUrl,
            time_updated: new Date()
          }
        }
      );
      
      console.log(`[backfillProfilePictures] ✓ Updated ${profile.username} with profile picture: ${imageUrl}`);
      updated++;
    } catch (error) {
      console.error(`[backfillProfilePictures] ✗ Error processing ${profile.username}:`, error.message);
      errors++;
    }
  }
  
  console.log("\n[backfillProfilePictures] Summary:");
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total processed: ${profilesWithoutPicture.length}`);
  
  process.exit(0);
}

// Run the script
backfillProfilePictures().catch((error) => {
  console.error("[backfillProfilePictures] Fatal error:", error);
  process.exit(1);
});

