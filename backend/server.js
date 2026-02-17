import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" 
  ? ".env.production" 
  : ".env.development";
dotenv.config({ path: path.join(__dirname, envFile) });

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
import profileRouter from "./routes/profile.js";
import uploadsRouter from "./routes/uploads.js";
import { initIndexes } from "./initIndexes.js";

import {
  cleanupExpiredReservations,
  cleanupOldSignatures
} from "./cleanup.js";
import { initSuperAdmin } from "./scripts/initSuperAdmin.js";

import { startWorker as startArweaveRetryWorker } from "./scripts/arweaveRetryWorker.js";

const app = express();

// Compression middleware - compress responses for faster transfers
// Only compress responses > 1KB and use gzip
app.use(compression({
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all other requests
    return compression.filter(req, res);
  },
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress if response > 1KB
}));

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

// Increase body parser limit for large uploads (10MB image = ~13.3MB base64)
app.use(express.json({ limit: '15mb' }));

// Store discovery endpoint (/.well-known/store-info)
app.get("/.well-known/store-info", (req, res) => {
  const startTime = Date.now();
  
  // Get store configuration from environment variables
  const storeId = process.env.STORE_ID || (process.env.NODE_ENV === "development" ? "local" : "main");
  const storeName = process.env.STORE_NAME || (process.env.NODE_ENV === "development" ? "Local Nomin" : "Nomin");
  const storePublicKey = process.env.STORE_PUBLIC_KEY || undefined;
  
  // Construct baseUrl - prefer env var, otherwise use nft.kodak.store
  let baseUrl = process.env.STORE_BASE_URL;
  if (!baseUrl) {
    const protocol = req.protocol || (req.get("x-forwarded-proto") || "http");
    // Always use nft.kodak.store as the hostname
    const host = process.env.NODE_ENV === "development" 
      ? `localhost:${process.env.PORT || 3000}`
      : "nft.kodak.store";
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
      const hostname = process.env.NODE_ENV === "development"
        ? "localhost"
        : "nft.kodak.store";
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Default icon for localhost
        const frontendPort = process.env.FRONTEND_PORT || '5173';
        storeIcon = `http://localhost:${frontendPort}/sljiva_icon.png`;
      } else {
        // Default icon for production: use nft.kodak.store
        storeIcon = `${protocol}://${hostname}/sljiva_icon.png`;
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
app.use("/api/profile", profileRouter);
app.use("/api/uploads", uploadsRouter);

// Background jobs
setInterval(cleanupExpiredReservations, 10 * 1000);   // every 10s (more frequent to catch expired reservations quickly)
setInterval(cleanupOldSignatures, 10 * 60 * 1000);    // every 10min

// Start Arweave retry worker
startArweaveRetryWorker().catch(err => {
  console.error("[server] Failed to start Arweave retry worker:", err);
});

// Start server
const PORT = process.env.PORT || 3000;
const workerId = process.pid;
const clusterWorkerId = process.env.CLUSTER_WORKER_ID;
const isFirstWorker = clusterWorkerId === "0" || !clusterWorkerId;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[Worker ${workerId}${clusterWorkerId ? ` (cluster:${clusterWorkerId})` : ""}] Server listening on http://0.0.0.0:${PORT}`);
  try {
    // Only run init on first worker to avoid duplicate operations
    if (isFirstWorker) {
      console.log(`[Worker ${workerId}] Running initialization (indexes, super admin)...`);
      await initIndexes();
      await initSuperAdmin();
    } else {
      console.log(`[Worker ${workerId}] Skipping initialization (not first worker)`);
    }
  } catch (err) {
    console.error(`[Worker ${workerId}] Failed to init:`, err);
  }
});
