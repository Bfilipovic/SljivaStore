#!/usr/bin/env node
/**
 * Initialize admin from environment variable
 * Run this on server startup or manually to set up an admin
 * Note: All admins can review uploads (no separate superadmin role)
 */

import { addAdmin } from "../services/adminService.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" 
  ? ".env.production" 
  : ".env.development";
dotenv.config({ path: path.join(__dirname, "..", envFile) });

async function initSuperAdmin() {
  const adminAddress = process.env.SUPERADMIN_ADDRESS; // Keep env var name for backward compatibility
  
  if (!adminAddress) {
    console.log("[initSuperAdmin] No SUPERADMIN_ADDRESS in environment, skipping...");
    return;
  }

  try {
    await addAdmin(adminAddress);
    console.log(`[initSuperAdmin] Admin initialized: ${adminAddress}`);
  } catch (error) {
    console.error("[initSuperAdmin] Error initializing admin:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initSuperAdmin()
    .then(() => {
      console.log("[initSuperAdmin] Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[initSuperAdmin] Fatal error:", error);
      process.exit(1);
    });
}

export { initSuperAdmin };

