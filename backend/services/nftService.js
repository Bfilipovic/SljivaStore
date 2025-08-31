import connectDB from "../db.js";
import crypto from "crypto";
import { hashObject } from "../utils/hash.js";

export async function getAllNFTs() {
  const db = await connectDB();
  return db.collection("nfts").find({}).toArray();
}

export async function getNFTsByCreator(address) {
  const db = await connectDB();
  return db.collection("nfts").find({ creator: address.toLowerCase() }).toArray();
}

export async function getNFTById(id) {
  const db = await connectDB();
  return db.collection("nfts").findOne({ _id: id });
}

export async function getPartsByNFT(nftId) {
  const db = await connectDB();
  return db.collection("parts").find({ parent_hash: nftId }).toArray();
}

export async function mintNFT(body, file) {
  const { name, description, parts, creator } = body;
  const imageurl = file ? `/uploads/${file.filename}` : body.imageUrl;

  if (!name || !description || !parts || !creator || !imageurl) {
    throw new Error("Missing required fields");
  }

  const nftObj = {
    name,
    description,
    creator: creator.toLowerCase(),
    imageurl,
    imagehash: crypto.createHash("sha256").update(imageurl).digest("hex"),
    time_created: new Date(),
    part_count: parseInt(parts),
    status: "minted",
  };
  const nftId = hashObject(nftObj);
  nftObj._id = nftId;

  const partDocs = [];
  for (let i = 0; i < nftObj.part_count; i++) {
    const part = {
      part_no: i,
      parent_hash: nftId,
      owner: creator.toLowerCase(),
      listing: null,
    };
    part._id = hashObject(part);
    partDocs.push(part);
  }

  const db = await connectDB();
  await db.collection("nfts").insertOne(nftObj);
  await db.collection("parts").insertMany(partDocs);

  return { success: true, id: nftId };
}
