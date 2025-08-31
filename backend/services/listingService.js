import connectDB from "../db.js";
import { ObjectId } from "mongodb";

export async function createListing(data, verifiedAddress) {
  const { price, nftId, seller, parts, bundleSale } = data;

  if (!price || !nftId || !seller || !Array.isArray(parts) || parts.length === 0) {
    throw new Error("Missing or invalid listing fields");
  }

  if (seller.toLowerCase() !== verifiedAddress.toLowerCase()) {
    throw new Error("Seller address mismatch");
  }

  const db = await connectDB();
  const listingDoc = {
    price,
    nftId,
    seller: seller.toLowerCase(),
    parts,
    status: "ACTIVE",
    type: bundleSale ? "BUNDLE" : "STANDARD",
    time_created: new Date(),
  };

  const result = await db.collection("listings").insertOne(listingDoc);
  const listingId = result.insertedId;

  await db.collection("parts").updateMany(
    { _id: { $in: parts } },
    { $set: { listing: listingId.toString() } }
  );

  return listingId;
}

export async function getActiveListings() {
  const db = await connectDB();
  return db.collection("listings").find({ status: { $ne: "DELETED" } }).toArray();
}

export async function deleteListing(listingId, data, verifiedAddress) {
  const { seller } = data;

  if (!seller) throw new Error("Missing seller address");

  const db = await connectDB();
  const listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  if (!listing) throw new Error("Listing not found");

  if (listing.seller !== seller.toLowerCase()) {
    throw new Error("Not authorized to delete this listing");
  }

  if (listing.parts?.length > 0) {
    await db.collection("parts").updateMany(
      { _id: { $in: listing.parts } },
      { $set: { listing: null } }
    );
  }

  await db.collection("listings").updateOne(
    { _id: new ObjectId(listingId) },
    { $set: { status: "DELETED" } }
  );
}
