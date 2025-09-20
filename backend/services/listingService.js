// backend/services/listingService.js
/**
 * Service: Listing handling
 *
 * Functions:
 * - createListing(data, verifiedAddress):
 *     Create a new listing for NFT parts.
 *     Expected body (signed):
 *       {
 *         price: string,                   // in YRT per part
 *         nftId: string,                   // NFT identifier
 *         seller: string,                  // ETH address (canonical identity)
 *         sellerWallets: {                 // optional map of currency->wallet
 *           "ETH": "0x....",
 *           "SOL": "SoLpubKey...",
 *           ...
 *         },
 *         parts: string[],                 // part IDs being listed
 *         bundleSale: boolean              // true = buyer must buy all parts
 *       }
 *
 *     Notes:
 *     - Seller identity is always ETH address.
 *     - sellerWallets may include ETH, SOL, etc. (ETH defaults to seller).
 *     - Parts are marked with this listing ID.
 *
 * - getActiveListings():
 *     Fetch all listings not marked DELETED.
 *
 * - deleteListing(listingId, data, verifiedAddress):
 *     Remove a listing if the signer is the seller.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";

export async function createListing(data, verifiedAddress) {
  const { price, nftId, seller, sellerWallets, parts, bundleSale } = data || {};

  if (!price || !nftId || !seller || !Array.isArray(parts) || parts.length === 0) {
    throw new Error("Missing or invalid listing fields");
  }
  if (seller.toLowerCase() !== verifiedAddress.toLowerCase()) {
    throw new Error("Seller address mismatch");
  }

  const db = await connectDB();

  const listingId = new ObjectId();

  // Normalize sellerWallets
  const wallets = {};
  if (sellerWallets && typeof sellerWallets === "object") {
    for (const [cur, addr] of Object.entries(sellerWallets)) {
      if (typeof addr === "string" && addr.trim() !== "") {
        wallets[cur.toUpperCase()] = addr.trim();
      }
    }
  }

  const listingDoc = {
    _id: listingId,
    price: String(price),
    nftId,
    seller: seller.toLowerCase(),
    sellerWallets: wallets,
    parts,
    type: bundleSale ? "BUNDLE" : "SINGLE",
    status: "ACTIVE",
    time_created: new Date(),
  };

  await db.collection("listings").insertOne(listingDoc);

  // Mark parts as listed
  await db.collection("parts").updateMany(
    { _id: { $in: parts } },
    { $set: { listing: listingId.toString() } }
  );

  return listingId.toString();
}

export async function getActiveListings() {
  const db = await connectDB();
  return db.collection("listings").find({ status: { $ne: "DELETED" } }).toArray();
}

export async function deleteListing(listingId, data, verifiedAddress) {
  const { seller } = data || {};
  if (!seller) throw new Error("Missing seller address");

  const db = await connectDB();

  const listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  if (!listing) throw new Error("Listing not found");

  if (listing.seller !== seller.toLowerCase()) {
    throw new Error("Not authorized to delete this listing");
  }

  // Mark listing as deleted
  await db.collection("listings").updateOne(
    { _id: new ObjectId(listingId) },
    { $set: { status: "DELETED", time_deleted: new Date() } }
  );

  // Reset parts.listing = null
  await db.collection("parts").updateMany(
    { _id: { $in: listing.parts } },
    { $set: { listing: null } }
  );
}
