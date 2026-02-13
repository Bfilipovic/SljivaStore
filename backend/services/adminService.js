import connectDB from "../db.js";
import { normalizeAddress } from "../utils/addressUtils.js";

// check if address is in admins collection
export async function isAdmin(address) {
  if (!address) return false;
  const db = await connectDB();
  const admin = await db.collection("admins").findOne({
    address: normalizeAddress(address),
  });
  return !!admin;
}

// add an admin (optional helper)
export async function addAdmin(address) {
  const db = await connectDB();
  const doc = { address: address.toLowerCase(), added_at: new Date() };
  await db.collection("admins").updateOne(
    { address: doc.address },
    { $setOnInsert: doc },
    { upsert: true }
  );
}
