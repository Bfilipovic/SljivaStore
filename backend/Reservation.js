import { ObjectId } from 'mongodb';

export default class Reservation {
  /**
   * @param {Object} params
   * @param {string|ObjectId} params.listingId - The ID of the listing
   * @param {string} params.reserver - The address or identifier of the reserver
   * @param {Date} params.timestamp - The time the reservation was made
   * @param {string[]} params.parts - The list of part IDs reserved
   */
  constructor({ listingId, reserver, timestamp, parts }) {
    this.listingId = typeof listingId === 'string' ? new ObjectId(listingId) : listingId;
    this.reserver = reserver;
    this.timestamp = timestamp || new Date();
    this.parts = parts;
  }
}
