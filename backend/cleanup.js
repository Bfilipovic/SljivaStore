// cleanup.js
import connectDB from './db.js';
import { ObjectId } from 'mongodb';
import { cleanupOldSignatures } from './utils/verifySignature.js';


export async function cleanupExpiredReservations() {
  const db = await connectDB();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 4 * 60 * 1000); // 4 minutes ago

  // find expired reservations
  const expired = await db
    .collection("reservations")
    .find({ timestamp: { $lt: cutoff } })
    .toArray();

  if (expired.length > 0) {
    console.log(
      `[RESERVATION CLEANUP] Found ${expired.length} expired reservations before ${cutoff.toISOString()}`
    );
  }

  for (const reservation of expired) {
    const reservationId = reservation._id;
    const listingId = reservation.listingId;

    console.log(`[RESERVATION CLEANUP] Cleaning reservation ${reservationId}`);

    // 1. Free parts: remove reservation flag from all parts tied to this reservation
    const resetRes = await db.collection("parts").updateMany(
      { reservation: reservationId.toString() },
      { $unset: { reservation: "" } }
    );
    console.log(
      `[RESERVATION CLEANUP] Cleared reservation from ${resetRes.modifiedCount} parts (reservation ${reservationId})`
    );

    // 2. Restore listing quantity
    const qty = reservation.quantity || 0;
    if (qty > 0) {
      const updateRes = await db.collection("listings").updateOne(
        { _id: typeof listingId === "string" ? new ObjectId(listingId) : listingId },
        { $inc: { quantity: qty }, $set: { time_updated: new Date() } }
      );
      console.log(
        `[RESERVATION CLEANUP] Restored ${qty} parts to listing ${listingId} (modified: ${updateRes.modifiedCount})`
      );
    }

    // 3. Remove the reservation record itself
    await db.collection("reservations").deleteOne({ _id: reservationId });
    console.log(`[RESERVATION CLEANUP] Reservation ${reservationId} deleted`);
  }
}

// Cleanup expired gifts
export async function cleanupExpiredGifts() {
  const db = await connectDB();
  const now = new Date();

  const expiredGifts = await db.collection('gifts').find({
    expires: { $lte: now },
    status: 'ACTIVE'
  }).toArray();

  if (expiredGifts.length > 0) {
    console.log(`[GIFT CLEANUP] Found ${expiredGifts.length} expired gifts`);
  }

  for (const gift of expiredGifts) {
    if (gift.parts && gift.parts.length > 0) {
      const updateRes = await db.collection('parts').updateMany(
        { _id: { $in: gift.parts } },
        { $set: { listing: null } }
      );
      console.log(`[GIFT CLEANUP] Reset listing for ${updateRes.modifiedCount} parts from gift ${gift._id}`);
    }

    await db.collection('gifts').updateOne(
      { _id: gift._id },
      { $set: { status: 'EXPIRED', expiredAt: now } }
    );
    console.log(`[GIFT CLEANUP] Gift ${gift._id} marked as EXPIRED`);
  }
}

// Export cleanupOldSignatures directly
export { cleanupOldSignatures };
