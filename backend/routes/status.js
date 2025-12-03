// backend/routes/status.js
/**
 * System status endpoints
 */

import express from "express";
import { getMaintenanceModeStatus } from "../services/arweaveQueueService.js";
import { getPendingQueueItems } from "../services/arweaveQueueService.js";

const router = express.Router();

// GET /api/status/maintenance - Check if system is in maintenance mode
router.get("/maintenance", async (req, res) => {
  try {
    const status = await getMaintenanceModeStatus();
    const queueCount = status.enabled ? (await getPendingQueueItems(1)).length : 0;
    
    res.json({
      maintenanceMode: status.enabled,
      reason: status.reason || "",
      updatedAt: status.updatedAt || null,
      pendingUploads: queueCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

