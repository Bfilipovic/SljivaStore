import express from "express";
import { createReservation } from "../services/reservationService.js";

const router = express.Router();

// POST /api/reservations
router.post("/", async (req, res) => {
  try {
    const reservation = await createReservation(req.body);
    res.json({ reservation });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
