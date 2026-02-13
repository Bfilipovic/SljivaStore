#!/usr/bin/env node
/**
 * Initialize superadmin from environment variable
 * Run this on server startup or manually to set up the superadmin
 */

import connectDB from "../db.js";
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
  const superAdminAddress = process.env.SUPERADMIN_ADDRESS;
  
  if (!superAdminAddress) {
    console.log("[initSuperAdmin] No SUPERADMIN_ADDRESS in environment, skipping...");
    return;
  }

  try {
    await addAdmin(superAdminAddress);
    console.log(`[initSuperAdmin] Superadmin initialized: ${superAdminAddress}`);
  } catch (error) {
    console.error("[initSuperAdmin] Error initializing superadmin:", error);
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

