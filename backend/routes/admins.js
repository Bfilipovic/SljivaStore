import express from "express";
import { isAdmin } from "../services/adminService.js";

const router = express.Router();

// GET /api/admins/check/:address
router.get("/check/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const result = await isAdmin(address);
    res.json({ isAdmin: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
