// backend/Reservation.js
// Standardizes reservation documents before inserting.
// New design: reservations store quantity, not parts[].

import { ObjectId } from "mongodb";
import { normalizeAddress } from "./utils/addressUtils.js";

export default class Reservation {
  /**
   * @param {Object} params
   * @param {string|ObjectId} params.listingId       - The listing _id
   * @param {string}          params.reserver        - ETH address (canonical buyer identity)
   * @param {number}          params.quantity        - Number of parts reserved
   * @param {string}          params.currency        - Chosen payment currency (e.g., "ETH", "SOL")
   * @param {string}          params.buyerWallet     - Wallet address on the chosen chain (payer)
   * @param {string}          params.sellerWallet    - Wallet address on the chosen chain (recipient)
   * @param {{currency: string, amount: string}} params.totalPriceCrypto - Full price in chosen crypto
   * @param {Date}            [params.timestamp]     - Creation time
   */
  constructor({
    listingId,
    reserver,
    quantity,
    currency,
    buyerWallet,
    sellerWallet,
    totalPriceCrypto,
    timestamp,
  }) {
    if (!listingId) throw new Error("Reservation missing listingId");
    if (!reserver) throw new Error("Reservation missing reserver");
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Reservation quantity must be a positive number");
    }
    if (!currency) throw new Error("Reservation missing currency");
    if (!buyerWallet) throw new Error("Reservation missing buyerWallet");
    if (!sellerWallet) throw new Error("Reservation missing sellerWallet");
    if (
      !totalPriceCrypto ||
      !totalPriceCrypto.currency ||
      totalPriceCrypto.amount == null
    ) {
      throw new Error("Reservation missing totalPriceCrypto");
    }

    this.listingId =
      typeof listingId === "string" ? new ObjectId(listingId) : listingId;
    this.reserver = normalizeAddress(reserver) || "";
    this.quantity = quantity;
    this.currency = currency.toUpperCase();
    this.buyerWallet = buyerWallet;
    this.sellerWallet = sellerWallet;
    this.totalPriceCrypto = {
      currency: this.currency,
      amount: String(totalPriceCrypto.amount),
    };
    this.timestamp = timestamp || new Date();
  }
}
