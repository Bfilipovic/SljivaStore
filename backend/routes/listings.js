import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import {
  createListing,
  getActiveListings,
  deleteListing,
  getUserListings,
  getCompletedUserListings,
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

// GET /api/listings
router.get("/", async (req, res) => {
  try {
    const listings = await getActiveListings();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/user/:address
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

// GET /api/listings/user/:address/completed
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
