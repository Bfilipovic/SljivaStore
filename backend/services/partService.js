import connectDB from "../db.js";

export async function getPartById(id) {
  const db = await connectDB();
  return db.collection("parts").findOne({ _id: id });
}

export async function getPartsByOwner(address) {
  const db = await connectDB();
  return db.collection("parts").find({ owner: address.toLowerCase() }).toArray();
}
