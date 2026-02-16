import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import { normalizeAddress } from "../utils/addressUtils.js";
import { getNFTsByOwner } from "../services/nftService.js";
import { createUpload, cancelUpload, getPendingUploads, acceptUpload, refuseUpload, getActiveUploadsForAddress, getCompletedUploadsForAddress, getConfirmedUploadsForAddress, getUploadById } from "../services/uploadService.js";

const router = express.Router();

// GET /api/uploads/nfts/:address - Get user's NFTs for payment selection
router.get("/nfts/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const nfts = await getNFTsByOwner(address);
    // Only return NFTs that have available parts (not listed or reserved)
    const nftsWithAvailable = nfts.filter(nft => nft.available > 0);
    res.json(nftsWithAvailable);
  } catch (err) {
    console.error("[GET /api/uploads/nfts/:address] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/pending - Get all pending uploads (admin only)
router.get("/pending", async (req, res) => {
  try {
    // Check admin status from query param or header
    const adminAddress = req.query.admin || req.headers['x-admin-address'];
    
    if (!adminAddress) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    // Check if address is an admin
    const { isAdmin } = await import("../services/adminService.js");
    const isAdminUser = await isAdmin(adminAddress);
    
    if (!isAdminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const uploads = await getPendingUploads();
    res.json({ items: uploads, total: uploads.length });
  } catch (err) {
    console.error("[GET /api/uploads/pending] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/user/:address - Get user's active uploads (must come before /:id routes)
router.get("/user/:address", async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    const skip = parseInt(req.query.skip || "0", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    console.log(`[GET /api/uploads/user/:address] Requested address: ${address}, skip: ${skip}, limit: ${limit}`);
    const result = await getActiveUploadsForAddress(address, skip, limit);
    console.log(`[GET /api/uploads/user/:address] Returning ${result.items.length} active uploads for ${address}`);
    res.json(result);
  } catch (err) {
    console.error("[GET /api/uploads/user/:address] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/user/:address/completed - Get user's completed uploads
router.get("/user/:address/completed", async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    const skip = parseInt(req.query.skip || "0", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    console.log(`[GET /api/uploads/user/:address/completed] Requested address: ${address}, skip: ${skip}, limit: ${limit}`);
    const result = await getCompletedUploadsForAddress(address, skip, limit);
    console.log(`[GET /api/uploads/user/:address/completed] Returning ${result.items.length} completed uploads for ${address}`);
    res.json(result);
  } catch (err) {
    console.error("[GET /api/uploads/user/:address/completed] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/user/:address/gallery - Get user's confirmed uploads (gallery)
router.get("/user/:address/gallery", async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    const skip = parseInt(req.query.skip || "0", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    console.log(`[GET /api/uploads/user/:address/gallery] Requested address: ${address}, skip: ${skip}, limit: ${limit}`);
    const result = await getConfirmedUploadsForAddress(address, skip, limit);
    console.log(`[GET /api/uploads/user/:address/gallery] Returning ${result.items.length} gallery items for ${address}`);
    res.json(result);
  } catch (err) {
    console.error("[GET /api/uploads/user/:address/gallery] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/:id - Get upload details with transaction info
router.get("/:id", async (req, res) => {
  try {
    const uploadId = req.params.id;
    const upload = await getUploadById(uploadId);
    
    if (!upload) {
      return res.status(404).json({ error: "Upload not found" });
    }
    
    res.json(upload);
  } catch (err) {
    console.error("[GET /api/uploads/:id] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/uploads - Create upload request
router.post("/", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const uploadId = await createUpload(
      req.verifiedData,
      req.verifiedAddress,
      req.signature
    );
    res.json({ success: true, id: uploadId });
  } catch (err) {
    console.error("[POST /api/uploads] Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/uploads/accept - Accept an upload (admin only, signed)
router.post("/accept", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const { uploadId } = req.verifiedData;
    if (!uploadId) {
      return res.status(400).json({ error: "Missing uploadId" });
    }
    
    const txId = await acceptUpload(uploadId, req.verifiedAddress, req.signature);
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    console.error("[POST /api/uploads/accept] Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/uploads/refuse - Refuse an upload (admin only, signed)
router.post("/refuse", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const { uploadId } = req.verifiedData;
    if (!uploadId) {
      return res.status(400).json({ error: "Missing uploadId" });
    }
    
    await refuseUpload(uploadId, req.verifiedAddress);
    res.json({ success: true });
  } catch (err) {
    console.error("[POST /api/uploads/refuse] Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/uploads/:id - Cancel/delete an upload
router.delete("/:id", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    await cancelUpload(req.params.id, req.verifiedAddress);
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/uploads/:id] Error:", err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
