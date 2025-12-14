import express from "express";
import cors from "cors";
import path from "path";

import nftsRouter from "./routes/nfts.js";
import partsRouter from "./routes/parts.js";
import listingsRouter from "./routes/listings.js";
import reservationsRouter from "./routes/reservations.js";
import transactionsRouter from "./routes/transactions.js";
import explorerRouter from "./routes/explorer.js";
import giftsRouter from "./routes/gifts.js";
import adminsRouter from "./routes/admins.js";
import ethRouter from "./routes/eth.js";
import statusRouter from "./routes/status.js";
import { initIndexes } from "./initIndexes.js";

import {
  cleanupExpiredReservations,
  cleanupOldSignatures
} from "./cleanup.js";

import { startWorker as startArweaveRetryWorker } from "./scripts/arweaveRetryWorker.js";

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

// CORS for Explorer API routes (always allow - these are public read-only endpoints)
app.use('/api/explorer', (req, res, next) => {
  const origin = req.headers.origin;
  // Always allow CORS for explorer routes (public read-only endpoints)
  // Use wildcard to allow any origin since these are read-only public endpoints
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
console.log('[CORS] Explorer API routes allow all origins (public read-only endpoints)');

app.use(express.json());

// Store discovery endpoint (/.well-known/store-info)
app.get("/.well-known/store-info", (req, res) => {
  const startTime = Date.now();
  
  // Get store configuration from environment variables
  const storeId = process.env.STORE_ID || (process.env.NODE_ENV === "development" ? "local" : "main");
  const storeName = process.env.STORE_NAME || (process.env.NODE_ENV === "development" ? "Local Nomin" : "Nomin");
  const storePublicKey = process.env.STORE_PUBLIC_KEY || undefined;
  
  // Construct baseUrl - prefer env var, otherwise construct from request
  let baseUrl = process.env.STORE_BASE_URL;
  if (!baseUrl) {
    const protocol = req.protocol || (req.get("x-forwarded-proto") || "http");
    const host = req.get("host") || `localhost:${process.env.PORT || 3000}`;
    baseUrl = `${protocol}://${host}/api/explorer`;
  } else {
    // Ensure baseUrl ends with /api/explorer if not already
    if (!baseUrl.endsWith("/api/explorer")) {
      baseUrl = baseUrl.replace(/\/$/, "") + "/api/explorer";
    }
  }
  
  // Get store icon - from env var or construct default based on host
  let storeIcon = process.env.STORE_ICON;
  if (!storeIcon) {
    try {
      const protocol = req.protocol || (req.get("x-forwarded-proto") || "http");
      const host = req.get("host") || `localhost:${process.env.PORT || 3000}`;
      const hostname = new URL(`${protocol}://${host}`).hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Default icon for localhost
        const frontendPort = process.env.FRONTEND_PORT || '5173';
        storeIcon = `http://localhost:${frontendPort}/sljiva_icon.png`;
      } else {
        // Default icon for production: use the store's domain
        storeIcon = `${protocol}://${host}/sljiva_icon.png`;
      }
    } catch {
      // If URL construction fails, leave icon undefined
    }
  }
  
  const response = {
    id: storeId,
    name: storeName,
    baseUrl: baseUrl,
  };
  
  // Add icon if available
  if (storeIcon) {
    response.icon = storeIcon;
  }
  
  // Add publicKey only if provided
  if (storePublicKey) {
    response.publicKey = storePublicKey;
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Store Discovery] GET /.well-known/store-info → 200 (${duration}ms) [id=${storeId}]`);
  
  res.json(response);
});

// Routers (all mounted under /api/*)
app.use("/api/nfts", nftsRouter);
app.use("/api/parts", partsRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/explorer", explorerRouter);
app.use("/api/gifts", giftsRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/eth", ethRouter);
app.use("/api/status", statusRouter);

// Background jobs
setInterval(cleanupExpiredReservations, 10 * 1000);   // every 10s (more frequent to catch expired reservations quickly)
setInterval(cleanupOldSignatures, 10 * 60 * 1000);    // every 10min

// Start Arweave retry worker
startArweaveRetryWorker().catch(err => {
  console.error("[server] Failed to start Arweave retry worker:", err);
});

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
