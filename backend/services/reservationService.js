// backend/services/reservationService.js
/**
 * Service: Reservation handling (refactored, no parts[] in payloads)
 *
 * Exports:
 * - createReservation(data): Promise<Reservation>
 *   Unsigned body:
 *     {
 *       listingId: string,
 *       reserver: string,           // ETH addr (canonical)
 *       quantity: number,           // how many parts to reserve
 *       currency: "ETH" | "SOL",
 *       buyerWallet: string
 *     }
 *
 * Notes:
 * - Removes requirement to pass `parts[]`. Reservation just stores quantity.
 * - Atomicity: marks N parts with reservationId in the parts collection.
 * - Listing doc keeps a running quantity count.
 * - Bundle listings must reserve all remaining parts.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";
import Reservation from "../Reservation.js";
import { yrtToCrypto } from "../utils/currency.js";

export async function createReservation({
    listingId,
    reserver,
    quantity,
    currency,
    buyerWallet,
}) {
    console.log("[createReservation] Called with:", {
        listingId,
        reserver,
        quantity,
        currency,
        buyerWallet,
    });

    if (!listingId || !reserver || !quantity) {
        throw new Error("Missing required fields");
    }

    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
        throw new Error("Invalid quantity");
    }
    console.log("[createReservation] Parsed quantity:", qty);

    const chosenCurrency = String(currency || "ETH").toUpperCase();
    const buyerWalletAddr = String(buyerWallet || "").trim();
    if (!buyerWalletAddr) throw new Error("Missing buyerWallet");
    if (!/^0x[a-fA-F0-9]{40}$/.test(reserver)) {
        throw new Error("Invalid reserver address (ETH)");
    }
    console.log("[createReservation] Using currency:", chosenCurrency);

    const db = await connectDB();
    const listingsCol = db.collection("listings");
    const partsCol = db.collection("parts");
    const reservationsCol = db.collection("reservations");

    // Check if user already has an active reservation (prevent spam)
    const reserverLower = String(reserver).toLowerCase();
    const now = new Date();
    const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);
    const existingReservation = await reservationsCol.findOne({
        reserver: reserverLower,
        timestamp: { $gte: sixtySecondsAgo }, // Active reservation (within last 60 seconds)
    });

    if (existingReservation) {
        throw new Error("You already have an active reservation. Please complete or wait for it to expire.");
    }

    // find listing
    const _id = typeof listingId === "string" ? new ObjectId(listingId) : listingId;
    const listing = await listingsCol.findOne({ _id });
    if (!listing) throw new Error("Listing not found");
    if (listing.status === "DELETED") throw new Error("Listing is deleted");
    console.log("[createReservation] Found listing:", {
        id: listing._id.toString(),
        nftId: listing.nftId,
        seller: listing.seller,
        quantity: listing.quantity,
        type: listing.type,
    });

    // bundle rule
    if (listing.type === "BUNDLE") {
        if (qty !== listing.quantity) {
            throw new Error("Must reserve all parts for a bundle listing");
        }
        console.log("[createReservation] Bundle rule OK, qty =", qty);
    } else {
        if (qty > listing.quantity) {
            throw new Error("Requested more parts than available");
        }
        console.log("[createReservation] Non-bundle rule OK, qty =", qty);
    }

    // Generate reservation ID first
    const reservationId = new ObjectId();

    // ATOMIC OPERATION: Lock parts atomically using findOneAndUpdate in a loop
    // This prevents race conditions by ensuring only one reservation can claim a part
    const lockedPartIds = [];
    const query = {
        parent_hash: listing.nftId,
        owner: listing.seller,
        listing: listing._id.toString(),
        $or: [{ reservation: null }, { reservation: { $exists: false } }],
    };

    // Helper function to unlock parts if something goes wrong
    const unlockParts = async () => {
        if (lockedPartIds.length > 0) {
            await partsCol.updateMany(
                { _id: { $in: lockedPartIds } },
                { $unset: { reservation: "" } }
            );
            console.log(`[createReservation] Unlocked ${lockedPartIds.length} parts due to error`);
        }
    };

    try {
        // Atomically lock parts one by one until we have enough
        for (let i = 0; i < qty; i++) {
            const result = await partsCol.findOneAndUpdate(
                query,
                { $set: { reservation: reservationId.toString() } },
                { returnDocument: "after" }
            );

            if (!result) {
                // Not enough free parts - unlock what we've locked so far
                await unlockParts();
                throw new Error(`Not enough available parts (locked ${lockedPartIds.length}, need ${qty})`);
            }

            lockedPartIds.push(result._id);
        }

        console.log("[createReservation] Successfully locked parts:", {
            requested: qty,
            locked: lockedPartIds.length,
        });

        // wallets
        const sellerWallet =
            listing.sellerWallets?.[chosenCurrency] || listing.sellerWallets?.ETH;
        if (!sellerWallet) {
            await unlockParts();
            throw new Error(`Listing does not accept currency ${chosenCurrency}`);
        }
        console.log("[createReservation] Seller wallet for currency:", {
            currency: chosenCurrency,
            wallet: sellerWallet,
        });

        // price conversion
        const perPartYrt = Number(listing.price);
        if (!isFinite(perPartYrt) || perPartYrt <= 0) {
            await unlockParts();
            throw new Error("Invalid listing price");
        }
        const totalYrt = perPartYrt * qty;
        console.log("[createReservation] Total price in YRT:", totalYrt);

        const amountCrypto = await yrtToCrypto(totalYrt, chosenCurrency);
        console.log("[createReservation] Converted price:", {
            currency: chosenCurrency,
            amount: amountCrypto,
        });

        const reservationDoc = new Reservation({
            listingId,
            reserver: String(reserver).toLowerCase(),
            quantity: qty,
            currency: chosenCurrency,
            buyerWallet: buyerWalletAddr,
            sellerWallet: String(sellerWallet).trim(),
            totalPriceCrypto: { currency: chosenCurrency, amount: String(amountCrypto) },
            timestamp: new Date(),
        });

        // Insert reservation
        await db.collection("reservations").insertOne({
            ...reservationDoc,
            _id: reservationId,
        });
        console.log("[createReservation] Reservation inserted:", reservationId.toString());

        // Update listing quantity
        const listUpdateRes = await listingsCol.updateOne(
            { _id: listing._id },
            { $inc: { quantity: -qty }, $set: { time_updated: new Date() } }
        );
        console.log("[createReservation] Listing quantity updated:", listUpdateRes);

        return { ...reservationDoc, _id: reservationId.toString() };
    } catch (error) {
        // If anything fails after locking parts, unlock them
        await unlockParts();
        throw error;
    }
}
