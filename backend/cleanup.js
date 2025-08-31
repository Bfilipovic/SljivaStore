// cleanup.js
import connectDB from './db.js';
import { ObjectId } from 'mongodb';
import { cleanupOldSignatures } from './utils/verifySignature.js';

// Cleanup expired reservations
export async function cleanupExpiredReservations() {
  const db = await connectDB();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 4 * 60 * 1000); // 4 minutes ago
  const expired = await db.collection('reservations').find({ timestamp: { $lt: cutoff } }).toArray();

  if (expired.length > 0) {
    console.log(`[RESERVATION CLEANUP] Cleaning up ${expired.length} expired reservations...`);
  }

  for (const reservation of expired) {
    const listingId = reservation.listingId;
    const parts = reservation.parts || [];

    await db.collection('listings').updateOne(
      { _id: typeof listingId === 'string' ? new ObjectId(listingId) : listingId },
      { $push: { parts: { $each: parts } } }
    );

    await db.collection('reservations').deleteOne({ _id: reservation._id });
    console.log(`[RESERVATION CLEANUP] Reservation ${reservation._id} deleted and parts restored.`);
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
