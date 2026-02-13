import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import {
  getProfileStatus,
  createVerificationRequest,
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

