import express from "express";
import { isAdmin } from "../services/adminService.js";
import { normalizeAddress, addressesMatch } from "../utils/addressUtils.js";

const router = express.Router();

// GET /api/admins/check/:address
router.get("/check/:address", async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    const result = await isAdmin(address);
    res.json({ isAdmin: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admins/superadmin/:address - Deprecated: kept for backward compatibility, just checks if admin
// All admins can review uploads (no separate superadmin role)
router.get("/superadmin/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const result = await isAdmin(address);
    console.log(`[GET /api/admins/superadmin/:address] Checking address: ${address}, isAdmin: ${result}`);
    res.json({ isSuperAdmin: result }); // Keep response format for backward compatibility
  } catch (err) {
    console.error(`[GET /api/admins/superadmin/:address] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
