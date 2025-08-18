import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

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