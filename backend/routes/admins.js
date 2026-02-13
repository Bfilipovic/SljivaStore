import express from "express";
import { isAdmin } from "../services/adminService.js";
import { normalizeAddress } from "../utils/addressUtils.js";

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
    const address = normalizeAddress(req.params.address);
    const superAdminAddress = process.env.SUPERADMIN_ADDRESS;
    const isSuperAdmin = superAdminAddress && normalizeAddress(address) === normalizeAddress(superAdminAddress);
    res.json({ isSuperAdmin: !!isSuperAdmin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
