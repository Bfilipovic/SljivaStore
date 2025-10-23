import express from "express";
import cors from "cors";
import path from "path";

import nftsRouter from "./routes/nfts.js";
import partsRouter from "./routes/parts.js";
import listingsRouter from "./routes/listings.js";
import reservationsRouter from "./routes/reservations.js";
import transactionsRouter from "./routes/transactions.js";
import giftsRouter from "./routes/gifts.js";
import adminsRouter from "./routes/admins.js";
import ethRouter from "./routes/eth.js";
import { initIndexes } from "./initIndexes.js";

import {
  cleanupExpiredReservations,
  cleanupExpiredGifts,
  cleanupOldSignatures
} from "./cleanup.js";

const app = express();

// CSP header
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https: data:; media-src 'self'; style-src 'unsafe-inline';"
  );
  next();
});

// CORS: only allow in development
if (process.env.NODE_ENV === "development") {
  console.log("CORS enabled (dev mode)");
  app.use(cors());
} else {
  console.log("CORS disabled (prod mode, same-origin via Nginx)");
}

app.use(express.json());

// Routers (all mounted under /api/*)
app.use("/api/nfts", nftsRouter);
app.use("/api/parts", partsRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/gifts", giftsRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/eth", ethRouter);

// Background jobs
setInterval(cleanupExpiredReservations, 30 * 1000);   // every 30s
setInterval(cleanupOldSignatures, 10 * 60 * 1000);    // every 10min
setInterval(cleanupExpiredGifts, 10 * 60 * 1000);     // every 10min

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  try {
    await initIndexes();
  } catch (err) {
    console.error("[server] Failed to init indexes:", err);
  }
});
