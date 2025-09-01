import connectDB from "../db.js";
import { ObjectId } from "mongodb";
import { yrtToEth } from "../utils/currency.js";

export async function createReservation({ listingId, reserver, parts }) {
  const db = await connectDB();
  const timestamp = new Date();

  if (!listingId || !reserver || !Array.isArray(parts) || parts.length === 0) {
    throw new Error("Missing required fields");
  }

  let listing;
  try {
    listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  } catch {
    throw new Error("Invalid listingId format");
  }
  if (!listing) throw new Error("Listing not found");

  if (listing.type === "BUNDLE") {
    const sameLength = parts.length === listing.parts.length;
    const sameSet = sameLength && parts.every((p) => listing.parts.includes(p));
    if (!sameSet) {
      throw new Error("Must reserve all parts for a bundle listing");
    }
  }

  const availableParts = listing.parts || [];
  const allAvailable = parts.every((p) => availableParts.includes(p));
  if (!allAvailable) {
    throw new Error("Some parts are already reserved or sold");
  }

  const updateResult = await db.collection("listings").updateOne(
    { _id: listing._id, parts: { $all: parts } },
    { $pull: { parts: { $in: parts } } }
  );
  if (updateResult.modifiedCount === 0) {
    throw new Error("Reservation failed, parts may have been taken");
  }

  const totalYrt = parts.length * listing.price;
  const totalEth = await yrtToEth(totalYrt);

  const reservation = {
    listingId,
    reserver,
    timestamp,
    totalPriceYrt: totalYrt,
    totalPriceEth: totalEth,
    parts,
  };

  await db.collection("reservations").insertOne(reservation);
  return reservation;
}
