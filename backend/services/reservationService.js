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

    // check how many free parts exist
    const freePartsCount = await partsCol.countDocuments({
        parent_hash: listing.nftId,
        owner: listing.seller,
        listing: listing._id.toString(),
        $or: [{ reservation: null }, { reservation: { $exists: false } }],
    });
    console.log("[createReservation] Free parts available:", freePartsCount);

    // lock N parts
    const reservationId = new ObjectId();
    // Find N free part IDs
    const freeParts = await partsCol
        .find({
            parent_hash: listing.nftId,
            owner: listing.seller,
            listing: listing._id.toString(),
            $or: [{ reservation: null }, { reservation: { $exists: false } }],
        })
        .limit(qty)
        .project({ _id: 1 })
        .toArray();

    if (freeParts.length < qty) {
        throw new Error(`Not enough available parts (found ${freeParts.length}, need ${qty})`);
    }

    // Update only those parts
    const partIds = freeParts.map((p) => p._id);
    const lockRes = await partsCol.updateMany(
        { _id: { $in: partIds } },
        { $set: { reservation: reservationId.toString() } }
    );

    console.log("[createReservation] Lock attempt:", {
        requested: qty,
        modified: lockRes.modifiedCount,
    });

    if (lockRes.modifiedCount < qty) {
        console.warn(
            `[createReservation] Only locked ${lockRes.modifiedCount}/${qty} parts. Throwing error.`,
        );
        throw new Error("Not enough available parts to reserve");
    }

    // wallets
    const sellerWallet =
        listing.sellerWallets?.[chosenCurrency] || listing.sellerWallets?.ETH;
    if (!sellerWallet) {
        throw new Error(`Listing does not accept currency ${chosenCurrency}`);
    }
    console.log("[createReservation] Seller wallet for currency:", {
        currency: chosenCurrency,
        wallet: sellerWallet,
    });

    // price conversion
    const perPartYrt = Number(listing.price);
    if (!isFinite(perPartYrt) || perPartYrt <= 0)
        throw new Error("Invalid listing price");
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
}
