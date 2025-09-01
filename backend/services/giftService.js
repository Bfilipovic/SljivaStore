import connectDB from "../db.js";
import { ObjectId } from "mongodb";

export async function createGift(data, verifiedAddress) {
  const { giver, receiver, nftId, parts } = data;

  if (!giver || !receiver || !nftId || !Array.isArray(parts) || parts.length === 0) {
    throw new Error("Invalid request data");
  }
  if (giver.toLowerCase() !== verifiedAddress.toLowerCase()) {
    throw new Error("Giver address mismatch");
  }

  const db = await connectDB();
  const partsCol = db.collection("parts");
  const giftsCol = db.collection("gifts");

  const foundParts = await partsCol.find({ _id: { $in: parts } }).toArray();
  if (foundParts.length !== parts.length) {
    throw new Error("Some parts not found");
  }
  for (const p of foundParts) {
    if (p.owner !== giver) throw new Error(`Part ${p._id} not owned by giver`);
    if (p.listing) throw new Error(`Part ${p._id} already listed or gifted`);
  }

  const gift = {
    giver: giver.toLowerCase(),
    receiver: receiver.toLowerCase(),
    nftId,
    parts,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    status: "ACTIVE",
  };
  const result = await giftsCol.insertOne(gift);
  const giftId = result.insertedId;

  await partsCol.updateMany(
    { _id: { $in: parts } },
    { $set: { listing: giftId.toString() } }
  );

  return giftId.toString();
}

export async function getGiftsForAddress(address) {
  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const now = new Date();
  return giftsCol.find({
    receiver: address.toLowerCase(),
    status: "ACTIVE",
    expires: { $gt: now },
  }).toArray();
}

export async function claimGift(data, verifiedAddress) {
  const { giftId, chainTx } = data;
  if (!giftId) throw new Error("Missing giftId");

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");
  const txCol = db.collection("transactions");
  const ptxCol = db.collection("partialtransactions");
  const nftsCol = db.collection("nfts");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) throw new Error("Gift not found");
  if (gift.status !== "ACTIVE") throw new Error("Gift not active");
  if (gift.expires <= new Date()) throw new Error("Gift expired");
  if (verifiedAddress.toLowerCase() !== gift.receiver.toLowerCase()) {
    throw new Error("Receiver address mismatch");
  }

  await partsCol.updateMany(
    { _id: { $in: gift.parts } },
    { $set: { owner: gift.receiver, listing: null } }
  );

  const nft = await nftsCol.findOne({ _id: gift.nftId });

  const txCount = await txCol.countDocuments();
  const transactionNumber = txCount + 1;
  const timestamp = new Date();

  const transaction = {
    transactionNumber,
    from: gift.giver,
    to: gift.receiver,
    listingId: gift._id,
    nftId: gift.nftId,
    numParts: gift.parts.length,
    partHashes: gift.parts,
    pricePerPartYrt: "0",
    totalPriceYrt: "0",
    totalPriceEth: "0",
    time: timestamp,
    chainTx: chainTx || null,
    status: "CONFIRMED",
  };
  const txResult = await txCol.insertOne(transaction);

  const partialTransactions = gift.parts.map((partId) => ({
    part: partId,
    from: gift.giver,
    to: gift.receiver,
    pricePerPartYrt: "0",
    pricePerPartEth: "0",
    timestamp,
    transaction: txResult.insertedId,
    chainTx: chainTx || null,
  }));
  if (partialTransactions.length > 0) {
    await ptxCol.insertMany(partialTransactions);
  }

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "CLAIMED", claimedAt: new Date() } }
  );

  return txResult.insertedId;
}

export async function refuseGift(data, verifiedAddress) {
  const { giftId } = data;
  if (!giftId) throw new Error("Missing giftId");

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) throw new Error("Gift not found");
  if (gift.expires <= new Date()) throw new Error("Gift expired");
  if (verifiedAddress.toLowerCase() !== gift.receiver.toLowerCase()) {
    throw new Error("Receiver address mismatch");
  }
  if (gift.status !== "ACTIVE") throw new Error("Gift not active");

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "REFUSED", refusedAt: new Date() } }
  );

  await partsCol.updateMany(
    { _id: { $in: gift.parts } },
    { $set: { listing: null } }
  );
}
