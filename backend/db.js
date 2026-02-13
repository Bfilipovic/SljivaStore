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
const client = new MongoClient(uri);

let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    // You can also make db name configurable via env if you want
    db = client.db(process.env.MONGO_DB || "nftstore");
    console.log(`Connected to Mongo at ${uri}, using db "${db.databaseName}"`);
  }
  return db;
}

export default connectDB;