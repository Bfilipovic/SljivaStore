import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import {
  getProfileStatus,
  createVerificationRequest,
  getProfileByUsername,
  getVerifiedPhotographers,
} from "../services/profileService.js";

const router = express.Router();

// POST /api/profile/verify (must come before /:address route)
router.post("/verify", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const profileId = await createVerificationRequest(
      req.verifiedAddress,
      req.verifiedData
    );
    res.json({ success: true, id: profileId });
  } catch (err) {
    console.error("[POST /api/profile/verify] Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/profile/photographers - Get all verified photographers with pagination and search
router.get("/photographers", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    
    const result = await getVerifiedPhotographers(skip, limit, search);
    res.json(result);
  } catch (err) {
    console.error("[GET /api/profile/photographers] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/username/:username - Get profile by username (public)
router.get("/username/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const result = await getProfileByUsername(username);
    res.json(result);
  } catch (err) {
    console.error("[GET /api/profile/username/:username] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/profile/:address
router.get("/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const result = await getProfileStatus(address);
    res.json(result);
  } catch (err) {
    console.error("[GET /api/profile/:address] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

