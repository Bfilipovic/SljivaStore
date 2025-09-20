// backend/services/reservationService.js
/**
 * Service: Reservation handling
 *
 * Functions:
 * - createReservation(data):
 *     Create a reservation for parts of a listing.
 *     Expected body (unsigned):
 *       {
 *         listingId: string,
 *         reserver: string,           // ETH address (canonical identity)
 *         parts: string[],            // part IDs to reserve
 *         currency: "ETH" | "SOL",    // chosen payment currency
 *         buyerWallet: string         // wallet on chosen chain
 *       }
 *
 *     Notes:
 *     - Immediately removes the reserved parts from listing.parts ($pull).
 *     - On expiration, cleanup.js will restore them.
 *     - sellerWallet is taken from listing.sellerWallets[currency] or falls back to ETH seller.
 *     - totalPriceCrypto is computed at reservation time.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";
import Reservation from "../Reservation.js";
import { yrtToCrypto } from "../utils/currency.js";

export async function createReservation({
  listingId,
  reserver,
  parts,
  currency,
  buyerWallet,
}) {
  if (!listingId || !reserver || !Array.isArray(parts) || parts.length === 0) {
    throw new Error("Missing required fields");
  }
  const chosenCurrency = String(currency || "ETH").toUpperCase();
  const buyerWalletAddr = String(buyerWallet || "").trim();
  if (!buyerWalletAddr) throw new Error("Missing buyerWallet");
  if (!/^0x[a-fA-F0-9]{40}$/.test(reserver)) {
    throw new Error("Invalid reserver address (ETH)");
  }

  const db = await connectDB();

  // Fetch listing
  let listing;
  try {
    const _id =
      typeof listingId === "string" ? new ObjectId(listingId) : listingId;
    listing = await db.collection("listings").findOne({ _id });
  } catch {
    throw new Error("Invalid listingId format");
  }
  if (!listing) throw new Error("Listing not found");
  if (listing.status === "DELETED") throw new Error("Listing is deleted");

  // Enforce bundle rule if applicable
  const isBundle = listing.type === "BUNDLE";
  if (isBundle) {
    const sameLength = parts.length === listing.parts.length;
    const sameSet =
      sameLength && parts.every((p) => listing.parts.includes(p));
    if (!sameSet) {
      throw new Error("Must reserve all parts for a bundle listing");
    }
  } else {
    // For non-bundle: ensure requested parts are subset of listing.parts
    const allPresent = parts.every((p) => listing.parts.includes(p));
    if (!allPresent) throw new Error("Some selected parts are not in listing");
  }

  // Atomically pull reserved parts out of listing
  const updateResult = await db.collection("listings").updateOne(
    { _id: listing._id, parts: { $all: parts } },
    { $pull: { parts: { $in: parts } } }
  );
  if (updateResult.modifiedCount === 0) {
    throw new Error("Reservation failed, parts may have been taken");
  }

  // Determine sellerWallet for chosen currency (fallbacks)
  const sellerWallet =
    listing.sellerWallets?.[chosenCurrency] ||
    (chosenCurrency === "ETH" ? listing.seller : null);
  if (!sellerWallet) {
    throw new Error(
      `Seller has no ${chosenCurrency} wallet configured for this listing`
    );
  }

  // Compute total price in chosen crypto
  const perPartYrt = Number(listing.price);
  if (!isFinite(perPartYrt) || perPartYrt <= 0) {
    throw new Error("Invalid listing price");
  }
  const totalYrt = perPartYrt * parts.length;
  const amountCrypto = await yrtToCrypto(totalYrt, chosenCurrency);

  // Create reservation doc
  const reservation = new Reservation({
    listingId: listing._id,
    reserver: reserver.toLowerCase(),
    parts,
    currency: chosenCurrency,
    buyerWallet: buyerWalletAddr,
    sellerWallet,
    totalPriceCrypto: { currency: chosenCurrency, amount: amountCrypto },
    timestamp: new Date(),
  });

  await db.collection("reservations").insertOne(reservation);

  return reservation;
}
