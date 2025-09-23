// backend/services/listingService.js
/**
 * Service: Listing handling (refactored to avoid shipping parts arrays)
 *
 * Exports:
 * - createListing(data, verifiedAddress): Promise<string>  // returns listingId
 *   Signed body:
 *     {
 *       price: string,                   // YRT per part
 *       nftId: string,                   // NFT ID
 *       seller: string,                  // ETH addr (canonical)
 *       sellerWallets?: Record<string,string>,
 *       quantity: number,                 // how many parts to list
 *       bundleSale?: boolean              // true => "BUNDLE" type
 *     }
 * - getActiveListings(): Promise<Listing[]>
 * - deleteListing(listingId, data, verifiedAddress): Promise<void>
 *
 * Notes:
 * - No longer requires passing `parts[]`. The service itself locks N available parts.
 * - Listing docs store `quantity` instead of full parts array.
 * - Actual parts are marked with `listing: listingId`.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";
import { logInfo } from "../utils/logger.js";

/**
 * Create a new listing for an NFT's parts.
 *
 * @param {Object} data
 * @param {string|number} data.price
 * @param {string} data.nftId
 * @param {string} data.seller
 * @param {Object} data.sellerWallets
 * @param {number} data.quantity
 * @param {boolean} [data.bundleSale]
 * @param {string} verifiedAddress - Address verified via signature
 * @returns {Promise<string>} listingId
 */
export async function createListing(data, verifiedAddress) {
    const { price, nftId, seller, sellerWallets = {}, quantity, bundleSale } = data;
    logInfo("[createListing] Called with:", { price, nftId, seller, quantity, bundleSale });

    if (!price || !nftId || !seller || !quantity) {
        throw new Error("Missing required listing fields");
    }
    if (String(seller).toLowerCase() !== String(verifiedAddress).toLowerCase()) {
        throw new Error("Seller address mismatch");
    }

    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
        throw new Error("Invalid quantity");
    }

    const db = await connectDB();
    const partsCol = db.collection("parts");
    const listingsCol = db.collection("listings");

    // Check available parts
    const availableCount = await partsCol.countDocuments({
        owner: seller.toLowerCase(),
        listing: null,
    });
    logInfo("[createListing] Available parts for seller:", availableCount);

    if (availableCount < qty) {
        throw new Error(`Seller has only ${availableCount} available parts, requested ${qty}`);
    }

    const listingId = new ObjectId();

    // normalize sellerWallets (uppercase keys, lowercase addresses)
    const wallets = {};
    for (const [cur, addr] of Object.entries(sellerWallets)) {
        if (typeof addr === "string" && addr.trim() !== "") {
            wallets[cur.toUpperCase()] =
                cur.toUpperCase() === "ETH"
                    ? addr.trim().toLowerCase()
                    : addr.trim(); // keep Solana (and others) case-sensitive
        }
    }

    const listingDoc = {
        _id: listingId,
        price: String(price),
        nftId: String(nftId),
        seller: String(seller).toLowerCase(),
        quantity: qty,
        sellerWallets: wallets,
        type: bundleSale ? "BUNDLE" : "PARTIAL",
        status: "ACTIVE",
        time_created: new Date(),
        time_updated: new Date(),
    };

    await listingsCol.insertOne(listingDoc);
    logInfo("[createListing] Inserted listing:", { id: listingId.toString() });

    // Safely pick N parts to mark
    const freeParts = await partsCol
        .find({ owner: seller.toLowerCase(), listing: null })
        .limit(qty)
        .project({ _id: 1 })
        .toArray();

    logInfo("[createListing] Free parts fetched:", freeParts.length);

    if (freeParts.length < qty) {
        throw new Error(`Could not find enough free parts (found ${freeParts.length}, need ${qty})`);
    }

    const partIds = freeParts.map((p) => p._id);
    const updateRes = await partsCol.updateMany(
        { _id: { $in: partIds } },
        { $set: { listing: listingId.toString() } }
    );

    logInfo("[createListing] Marked parts for listing:", {
        requested: qty,
        modified: updateRes.modifiedCount,
    });

    return listingId.toString();
}

export async function getActiveListings() {
    const db = await connectDB();
    return db.collection("listings").find({ status: { $ne: "DELETED" } }).toArray();
}

export async function deleteListing(listingId, data, verifiedAddress) {
    const { seller } = data;
    if (!seller) throw new Error("Missing seller address");

    const db = await connectDB();
    const listingsCol = db.collection("listings");

    const listing = await listingsCol.findOne({ _id: new ObjectId(String(listingId)) });
    if (!listing) throw new Error("Listing not found");
    if (listing.seller !== String(seller).toLowerCase()) {
        throw new Error("Not authorized to delete this listing");
    }

    // mark as deleted
    await listingsCol.updateOne(
        { _id: listing._id },
        { $set: { status: "DELETED", time_deleted: new Date() } }
    );

    // Release parts (set listing=null for parts still pointing here)
    await db.collection("parts").updateMany(
        { listing: listing._id.toString() },
        { $set: { listing: null, reservation: null } }
    );

    logInfo(`[deleteListing] Deleted listing ${listingId} by ${seller}`);
}
