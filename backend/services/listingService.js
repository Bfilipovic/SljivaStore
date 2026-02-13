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
import { TX_TYPES } from "../utils/transactionTypes.js";
import { createTransactionDoc } from "../utils/transactionBuilder.js";
import { hashObject, hashableTransaction } from "../utils/hash.js";
import { getNextTransactionInfo, uploadTransactionToArweave } from "./arweaveService.js";

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
 * @param {string} signature - Signature from the request
 * @returns {Promise<string>} listingId
 */
export async function createListing(data, verifiedAddress, signature) {
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
        .find({
            owner: seller.toLowerCase(),
            listing: null,
            parent_hash: String(nftId)
        })
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

    // Create LISTING_CREATE transaction
    const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
    
    const listingTxDoc = createTransactionDoc({
        type: TX_TYPES.LISTING_CREATE,
        transaction_number: transactionNumber,
        signer: verifiedAddress,
        signature: signature,
        overrides: {
            listingId: listingId.toString(),
            nftId: String(nftId),
            seller: seller,
            quantity: qty,
            currency: "YRT", // Listing price is in YRT
            price: String(price),
            sellerWallets: wallets,
            bundleSale: bundleSale === true || bundleSale === "true",
        },
    });
    
    // Generate hash-based ID
    const listingTxId = hashObject(hashableTransaction(listingTxDoc));
    listingTxDoc._id = listingTxId;
    
    // Insert transaction
    await db.collection("transactions").insertOne(listingTxDoc);
    logInfo(`[createListing] Created LISTING_CREATE transaction: ${listingTxId}`);
    
    // Fetch NFT imageUrl for Arweave upload (not part of hash)
    const nft = await db.collection("nfts").findOne({ _id: nftId });
    const imageUrl = nft?.imageurl || null;
    
    // Upload to Arweave
    let arweaveTxId = null;
    try {
        arweaveTxId = await uploadTransactionToArweave(listingTxDoc, transactionNumber, previousArweaveTxId, imageUrl);
        await db.collection("transactions").updateOne(
            { _id: listingTxId },
            { $set: { arweaveTxId: arweaveTxId } }
        );
        logInfo(`[createListing] LISTING_CREATE transaction uploaded to Arweave: ${arweaveTxId}`);
    } catch (error) {
        logInfo(`[createListing] Warning: Failed to upload LISTING_CREATE to Arweave: ${error.message}`);
    }

    return listingId.toString();
}

export async function getActiveListings() {
    const db = await connectDB();
    return db.collection("listings").find({ status: { $nin: ["CANCELED", "COMPLETED"] } }).toArray();
}

/**
 * Get active listings for a specific user with pagination
 * @param {string} sellerAddress - The seller's address (lowercase)
 * @param {number} skip - Number of listings to skip
 * @param {number} limit - Maximum number of listings to return
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getUserListings(sellerAddress, skip = 0, limit = 20) {
    const db = await connectDB();
    const listingsCol = db.collection("listings");
    
    const query = {
        seller: String(sellerAddress).toLowerCase(),
        status: { $nin: ["CANCELED", "COMPLETED"] }
    };
    
    const [items, total] = await Promise.all([
        listingsCol
            .find(query)
            .sort({ time_created: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        listingsCol.countDocuments(query)
    ]);
    
    return { items, total };
}

/**
 * Get completed listings (COMPLETED or CANCELED status) for a user
 * @param {string} sellerAddress - The seller's address (lowercase)
 * @param {number} skip - Number of listings to skip
 * @param {number} limit - Maximum number of listings to return
 * @returns {Promise<{items: Array, total: number}>}
 */
export async function getCompletedUserListings(sellerAddress, skip = 0, limit = 20) {
    const db = await connectDB();
    const listingsCol = db.collection("listings");
    const txCol = db.collection("transactions");
    
    // Get listings with COMPLETED or CANCELED status
    const query = {
        seller: String(sellerAddress).toLowerCase(),
        status: { $in: ["COMPLETED", "CANCELED"] }
    };
    
    const [listings, total] = await Promise.all([
        listingsCol
            .find(query)
            .sort({ time_created: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        listingsCol.countDocuments(query)
    ]);
    
    // Attach transaction info to each listing
    const listingsWithTx = await Promise.all(
        listings.map(async (listing) => {
            const listingIdStr = listing._id.toString();
            
            // Find buy transaction if completed
            let buyTx = null;
            if (listing.status === "COMPLETED") {
                buyTx = await txCol.findOne({
                    type: TX_TYPES.NFT_BUY,
                    listingId: listingIdStr,
                });
            }
            
            // Find cancel transaction if canceled
            let cancelTx = null;
            if (listing.status === "CANCELED") {
                cancelTx = await txCol.findOne({
                    type: TX_TYPES.LISTING_CANCEL,
                    listingId: listingIdStr,
                });
            }
            
            return {
                ...listing,
                buyTransaction: buyTx ? { _id: buyTx._id, arweaveTxId: buyTx.arweaveTxId } : null,
                cancelTransaction: cancelTx ? { _id: cancelTx._id, arweaveTxId: cancelTx.arweaveTxId } : null,
            };
        })
    );
    
    return { items: listingsWithTx, total };
}

export async function deleteListing(listingId, data, verifiedAddress, signature) {
    const { seller } = data;
    if (!seller) throw new Error("Missing seller address");

    const db = await connectDB();
    const listingsCol = db.collection("listings");
    const txCol = db.collection("transactions");

    const listing = await listingsCol.findOne({ _id: new ObjectId(String(listingId)) });
    if (!listing) throw new Error("Listing not found");
    if (listing.seller !== String(seller).toLowerCase()) {
        throw new Error("Not authorized to delete this listing");
    }
    
    // Check if listing is still active (not already cancelled/completed)
    if (listing.status === "CANCELED") {
        throw new Error("Listing already canceled");
    }
    if (listing.status === "COMPLETED") {
        throw new Error("Cannot cancel a completed listing");
    }
    
    // Check if there are available parts (parts still locked to this listing, not reserved)
    const partsCol = db.collection("parts");
    const availablePartsCount = await partsCol.countDocuments({
        listing: listingId.toString(),
        reservation: { $exists: false }
    });
    
    // Check if there are active reservations for this listing
    const reservationsCol = db.collection("reservations");
    const activeReservationsCount = await reservationsCol.countDocuments({
        listingId: listingId.toString(),
    });
    
    // Only allow cancellation if there are available parts and no active reservations
    // If no available parts and no reservations, listing should be marked as COMPLETED, not canceled
    if (availablePartsCount === 0 && activeReservationsCount === 0) {
        throw new Error("Cannot cancel listing: all parts have been sold and there are no active reservations. Listing should be marked as COMPLETED.");
    }
    
    // Don't allow cancellation if there are active reservations
    if (activeReservationsCount > 0) {
        throw new Error("Cannot cancel listing: there are active reservations. Please wait for them to complete or expire.");
    }
    
    // If we get here, there are available parts and no active reservations - cancellation is allowed

    // mark as canceled
    await listingsCol.updateOne(
        { _id: listing._id },
        { $set: { status: "CANCELED", time_canceled: new Date() } }
    );

    // Release parts (set listing=null for parts still pointing here)
    const releaseResult = await db.collection("parts").updateMany(
        { listing: listing._id.toString() },
        { $set: { listing: null }, $unset: { reservation: "" } }
    );
    
    logInfo(`[deleteListing] Released ${releaseResult.modifiedCount} parts from listing ${listingId}`);

    // Create LISTING_CANCEL transaction
    const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
    
    const cancelTxDoc = createTransactionDoc({
        type: TX_TYPES.LISTING_CANCEL,
        transaction_number: transactionNumber,
        signer: verifiedAddress,
        signature: signature,
        overrides: {
            listingId: listingId.toString(),
            nftId: String(listing.nftId),
            seller: seller,
            quantity: Number(listing.quantity || 0),
        },
    });
    
    // Generate hash-based ID
    const cancelTxId = hashObject(hashableTransaction(cancelTxDoc));
    cancelTxDoc._id = cancelTxId;
    
    // Insert transaction
    await txCol.insertOne(cancelTxDoc);
    logInfo(`[deleteListing] Created LISTING_CANCEL transaction: ${cancelTxId}`);
    
    // Fetch NFT imageUrl for Arweave upload (not part of hash)
    const nft = await db.collection("nfts").findOne({ _id: listing.nftId });
    const imageUrl = nft?.imageurl || null;
    
    // Upload to Arweave
    let arweaveTxId = null;
    try {
        arweaveTxId = await uploadTransactionToArweave(cancelTxDoc, transactionNumber, previousArweaveTxId, imageUrl);
        await txCol.updateOne(
            { _id: cancelTxId },
            { $set: { arweaveTxId: arweaveTxId } }
        );
        logInfo(`[deleteListing] LISTING_CANCEL transaction uploaded to Arweave: ${arweaveTxId}`);
    } catch (error) {
        logInfo(`[deleteListing] Warning: Failed to upload LISTING_CANCEL to Arweave: ${error.message}`);
    }

    logInfo(`[deleteListing] Canceled listing ${listingId} by ${seller}`);
}
