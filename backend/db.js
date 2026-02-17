import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" 
  ? ".env.production" 
  : ".env.development";
dotenv.config({ path: path.join(__dirname, envFile) });

const uri = process.env.MONGO_URL || "mongodb://localhost:27017";

// Configure MongoDB connection with optimized pooling
const client = new MongoClient(uri, {
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || "50", 10), // Maximum number of connections in pool
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || "5", 10), // Minimum number of connections in pool
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server
  socketTimeoutMS: 45000, // How long to wait for socket operations
  connectTimeoutMS: 10000, // How long to wait for initial connection
});

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    // You can also make db name configurable via env if you want
    db = client.db(process.env.MONGO_DB || "nftstore");
    console.log(`Connected to Mongo at ${uri}, using db "${db.databaseName}" (pool: ${process.env.MONGO_MIN_POOL_SIZE || 5}-${process.env.MONGO_MAX_POOL_SIZE || 50})`);
  }
  return db;
}

export default connectDB;