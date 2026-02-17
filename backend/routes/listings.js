import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import {
  createListing,
  getActiveListings,
  deleteListing,
  getUserListings,
  getCompletedUserListings,
  getListingById,
} from "../services/listingService.js";

const router = express.Router();

// POST /api/listings
router.post("/", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const listingId = await createListing(req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true, id: listingId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/listings/user/:address/completed (must come before /user/:address)
router.get("/user/:address/completed", async (req, res) => {
  try {
    const address = req.params.address;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await getCompletedUserListings(address, skip, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/user/:address (must come before /:id)
router.get("/user/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await getUserListings(address, skip, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/:id (must come before GET /listings to avoid conflicts)
router.get("/:id", async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings?skip=0&limit=50 (least specific, comes last)
router.get("/", async (req, res) => {
  try {
    const skip = Math.max(0, parseInt(req.query.skip || "0", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
    
    const result = await getActiveListings({ skip, limit });
    res.json({
      items: result.items,
      total: result.total,
      skip,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/listings/:id
router.delete("/:id", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    await deleteListing(req.params.id, req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/listings/:id] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
