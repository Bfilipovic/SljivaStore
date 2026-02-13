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

// GET /api/admins/superadmin/:address - Check if address is superadmin
router.get("/superadmin/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const superAdminAddress = process.env.SUPERADMIN_ADDRESS;
    console.log(`[GET /api/admins/superadmin/:address] Checking address: ${address}`);
    console.log(`[GET /api/admins/superadmin/:address] Superadmin address from env: ${superAdminAddress}`);
    const isSuperAdmin = superAdminAddress && addressesMatch(address, superAdminAddress);
    console.log(`[GET /api/admins/superadmin/:address] Result: ${isSuperAdmin}`);
    res.json({ isSuperAdmin: !!isSuperAdmin });
  } catch (err) {
    console.error(`[GET /api/admins/superadmin/:address] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
