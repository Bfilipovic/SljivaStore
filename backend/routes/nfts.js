import express from 'express';
import multer from 'multer';
import connectDB from '../db.js';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { ethers } from 'ethers';


const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 🔧 Utility: hash content deterministically
function hashObject(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

// Utility: verify Ethereum-style signature
function verifyEthSignature({ address, signature, data }) {
  try {
    console.log('--- ETH Signature Verification ---');
    console.log('Address:', address);
    console.log('Signature:', signature);
    console.log('Data to verify:', data);
    // Stable field order for signing
    const ordered = {};
    Object.keys(data).sort().forEach(k => { ordered[k] = data[k]; });
    const message = JSON.stringify(ordered);
    console.log('Message stringified:', message);
    // Recover address from signature
    const recovered = ethers.verifyMessage(message, signature);
    console.log('Recovered address:', recovered);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch (e) {
    console.error('ETH signature verification error:', e);
    return false;
  }
}

// Utility: check timestamp nonce
function isTimestampValid(ts) {
  const now = Date.now();
  const diff = Math.abs(now - Number(ts));
  return diff < 2 * 60 * 1000; // 2 minutes
}

// Helper: validate and verify signed request, with nonce uniqueness
async function validateSignedRequest(req, res, requiredFields) {
  const { address, signature, timestamp } = req.body;
  console.log('--- Signed Request Validation ---');
  console.log('Request body:', req.body);
  if (!address || !signature || !timestamp) {
    console.log('Missing address, signature, or timestamp');
    res.status(400).json({ error: 'Missing address, signature, or timestamp' });
    return false;
  }
  if (!isTimestampValid(timestamp)) {
    console.log('Invalid or expired timestamp:', timestamp);
    res.status(400).json({ error: 'Invalid or expired timestamp' });
    return false;
  }
  for (const field of requiredFields) {
    if (!(field in req.body)) {
      console.log('Missing required field:', field);
      res.status(400).json({ error: `Missing required field: ${field}` });
      return false;
    }
  }
  // Verify signature
  const dataToVerify = { ...req.body };
  delete dataToVerify.signature;
  console.log('Data to verify (no signature):', dataToVerify);
  if (!verifyEthSignature({ address, signature, data: dataToVerify })) {
    console.log('Signature verification failed');
    res.status(401).json({ error: 'Invalid signature' });
    return false;
  }
  // Nonce uniqueness check
  const db = await connectDB();
  const nonceKey = `${address}:${timestamp}`;
  const nonceExists = await db.collection('nonces').findOne({ nonceKey });
  if (nonceExists) {
    console.log('Nonce already used:', nonceKey);
    res.status(409).json({ error: 'Nonce already used' });
    return false;
  }
  await db.collection('nonces').insertOne({ nonceKey, created: new Date() });
  console.log('Nonce stored:', nonceKey);
  return true;
}

// 🧩 Get all NFTs
router.get('/', async (req, res) => {
  const db = await connectDB();
  const nfts = await db.collection('nfts').find({}).toArray();
  console.log('GET /nfts →', nfts.length, 'found');
  res.json(nfts);
});

// 🧑 Get NFTs by creator/owner
router.get('/creator/:address', async (req, res) => {
  const db = await connectDB();
  const creator = req.params.address.toLowerCase();
  try {
    const nfts = await db.collection('nfts').find({ creator: creator }).toArray();
    console.log(`GET /nfts/creator/${creator} → ${nfts.length} found`);
    res.json(nfts);
  } catch (err) {
    console.error('GET /nfts/creator error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🎨 Mint new NFT and parts
router.post('/mint', upload.single('imageFile'), async (req, res) => {
  if (!(await validateSignedRequest(req, res, ['name', 'description', 'parts', 'creator', 'timestamp', 'address', 'signature']))) return;
  const db = await connectDB();
  const { name, description, parts, creator, timestamp } = req.body;
  const file = req.file;
  const imageurl = file ? `/uploads/${file.filename}` : req.body.imageUrl;

  if (!name || !description || !parts || !creator || !imageurl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const nftObj = {
    name,
    description,
    creator: creator.toLowerCase(),
    imageurl,
    imagehash: crypto.createHash('sha256').update(imageurl).digest('hex'),
    time_created: timestamp ? new Date(timestamp) : new Date(),
    part_count: parseInt(parts),
    status: 'minted'
  };
  const nftId = hashObject(nftObj);
  nftObj._id = nftId;

  const partDocs = [];
  for (let i = 0; i < nftObj.part_count; i++) {
    const part = {
      part_no: i,
      parent_hash: nftId,
      owner: creator.toLowerCase(),
      listing: null
    };
    part._id = hashObject(part);
    partDocs.push(part);
  }

  try {
    await db.collection('nfts').insertOne(nftObj);
    await db.collection('parts').insertMany(partDocs);
    console.log(`Minted NFT: ${nftId}, parts: ${partDocs.length}`);
    res.json({ success: true, id: nftId });
  } catch (e) {
    console.error('POST /mint error:', e);
    res.status(500).json({ error: 'Failed to mint NFT' });
  }
});

// 🔎 Get part by ID
router.get('/part/:id', async (req, res) => {
  const db = await connectDB();
  try {
    const part = await db.collection('parts').findOne({ _id: req.params.id });
    if (!part) return res.status(404).json({ error: 'Part not found' });
    res.json(part);
  } catch (e) {
    console.error('GET /part/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 📚 Get all parts of a parent NFT
router.get('/:nftId/parts', async (req, res) => {
  const db = await connectDB();
  try {
    const parts = await db.collection('parts').find({ parent_hash: req.params.nftId }).toArray();
    res.json(parts);
  } catch (e) {
    console.error('GET /:nftId/parts error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🧍 Get all parts owned by user
router.get('/parts/owner/:address', async (req, res) => {
  const db = await connectDB();
  const address = req.params.address.toLowerCase();
  try {
    const parts = await db.collection('parts').find({ owner: address }).toArray();
    res.json(parts);
  } catch (e) {
    console.error('GET /parts/owner/:address error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Create a listing
router.post('/createListing', async (req, res) => {
  if (!(await validateSignedRequest(req, res, ['price', 'nftId', 'seller', 'parts', 'timestamp', 'address', 'signature']))) return;
  const db = await connectDB();
  console.log('Create listing req.body:', req.body);

  const { price, nftId, seller, parts } = req.body;

  if (!price || !nftId || !seller || !parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid listing fields' });
  }

  try {
    const listingDoc = {
      price,
      nftId,
      seller: seller.toLowerCase(),
      parts,
      time_created: new Date()
    };

    const result = await db.collection('listings').insertOne(listingDoc);
    const listingId = result.insertedId;
    console.log(`Created listing with ID: ${listingId}`);

    // Update each part's listing field to point to the new listing ID
    await db.collection('parts').updateMany(
      { _id: { $in: parts } },
      { $set: { listing: listingId.toString() } } // storing as string or ObjectId — pick what you prefer
    );

    res.json({ success: true, id: listingId });
  } catch (e) {
    console.error('POST /nfts/createListing error:', e);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Get all listings
router.get('/listings', async (req, res) => {
  const db = await connectDB();

  try {
    const listings = await db.collection('listings').find({}).toArray();
    res.json(listings);
  } catch (e) {
    console.error('GET /listings error:', e);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});


// 📦 Get one NFT by ID
router.get('/:id', async (req, res) => {
  const db = await connectDB();
  try {
    const nft = await db.collection('nfts').findOne({ _id: req.params.id });
    if (!nft) return res.status(404).json({ error: 'NFT not found' });
    res.json(nft);
  } catch (error) {
    console.error('GET /nfts/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /listings/:id
router.delete('/listings/:id', async (req, res) => {
  if (!(await validateSignedRequest(req, res, ['seller', 'timestamp', 'address', 'signature']))) return;
  const db = await connectDB();
  const listingId = req.params.id;
  const { seller } = req.body;

  console.log("Deleting listing ", listingId)

  if (!seller) {
    return res.status(400).json({ error: 'Missing seller address in request body' });
  }

  try {
    // Find the listing first
    const listing = await db.collection('listings').findOne({ _id: new ObjectId(listingId) });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.seller !== seller.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    // Set the listing field for its parts to null
    if (listing.parts && listing.parts.length > 0) {
      await db.collection('parts').updateMany(
        { _id: { $in: listing.parts } },
        { $set: { listing: null } }
      );
      console.log(`Set listing field to null for ${listing.parts.length} parts of deleted listing ${listingId}`);
    }
    // Delete the listing
    await db.collection('listings').deleteOne({ _id: new ObjectId(listingId) });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /listings/:id error:', e);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// Reserve parts from a listing (mutex-like reservation)
router.post('/reserve', async (req, res) => {
  if (!(await validateSignedRequest(req, res, ['listingId', 'reserver', 'parts', 'timestamp', 'address', 'signature']))) return;
  console.log('POST /nfts/reserve called with body:', req.body);
  const db = await connectDB();
  const { listingId, reserver, parts } = req.body;
  const timestamp = new Date();
  if (!listingId || !reserver || !Array.isArray(parts) || parts.length === 0) {
    console.log('POST /nfts/reserve error: Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Find the listing
  let listing;
  try {
    listing = await db.collection('listings').findOne({ _id: new ObjectId(listingId) });
  } catch (e) {
    console.log('POST /nfts/reserve error: Invalid listingId format', e);
    return res.status(400).json({ error: 'Invalid listingId format' });
  }
  if (!listing) {
    console.log('POST /nfts/reserve error: Listing not found');
    return res.status(404).json({ error: 'Listing not found' });
  }

  // Check if all requested parts are still available
  const availableParts = listing.parts || [];
  const allAvailable = parts.every(p => availableParts.includes(p));
  if (!allAvailable) {
    console.log('POST /nfts/reserve error: Some parts are already reserved or sold');
    return res.status(409).json({ error: 'Some parts are already reserved or sold' });
  }

  // Remove reserved parts from the listing (atomic update)
  const updateResult = await db.collection('listings').updateOne(
    { _id: listing._id, parts: { $all: parts } },
    { $pull: { parts: { $in: parts } } }
  );
  if (updateResult.modifiedCount === 0) {
    console.log('POST /nfts/reserve error: Reservation failed, parts may have been taken');
    return res.status(409).json({ error: 'Reservation failed, parts may have been taken' });
  }

  // Create reservation object
  const reservation = {
    listingId,
    reserver,
    timestamp,
    parts,
  };
  await db.collection('reservations').insertOne(reservation);
  console.log('POST /nfts/reserve success:', reservation);
  res.json({ reservation });
});

// Create a transaction after reservation and mnemonic confirmation
router.post('/createTransaction', async (req, res) => {
  if (!(await validateSignedRequest(req, res, ['listingId', 'reservationId', 'buyer', 'timestamp', 'address', 'signature']))) return;
  const db = await connectDB();
  const { listingId, reservationId, buyer, timestamp } = req.body;
  console.log('POST /nfts/createTransaction called with:', req.body);

  if (!listingId || !reservationId || !buyer || !timestamp) {
    console.log('POST /nfts/createTransaction error: Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check reservation exists
  const reservation = await db.collection('reservations').findOne({ _id: new ObjectId(reservationId) });
  if (!reservation) {
    console.log('POST /nfts/createTransaction error: Reservation not found');
    return res.status(404).json({ error: 'Reservation not found or expired' });
  }

  // Check reserver matches buyer
  if (reservation.reserver !== buyer) {
    console.log('POST /nfts/createTransaction error: Reserver does not match buyer');
    return res.status(403).json({ error: 'Reserver does not match buyer' });
  }

  // Get listing
  const listing = await db.collection('listings').findOne({ _id: new ObjectId(listingId) });
  if (!listing) {
    console.log('POST /nfts/createTransaction error: Listing not found');
    return res.status(404).json({ error: 'Listing not found' });
  }

  // Get NFT
  const nft = await db.collection('nfts').findOne({ _id: listing.nftId });
  if (!nft) {
    console.log('POST /nfts/createTransaction error: NFT not found');
    return res.status(404).json({ error: 'NFT not found' });
  }

  // Get transaction number (incremental)
  const txCount = await db.collection('transactions').countDocuments();
  const transactionNumber = txCount + 1;

  // Prepare transaction object
  const transaction = {
    transactionNumber,
    from: listing.seller,
    to: buyer,
    listingId: listing._id,
    nftId: nft._id,
    numParts: reservation.parts.length,
    partHashes: reservation.parts,
    price: listing.price,
    time: timestamp,
    status: 'CONFIRMED',
  };

  // Insert transaction
  const txResult = await db.collection('transactions').insertOne(transaction);
  console.log('Transaction created:', transaction);

  // Create PartialTransactions for each part
  const partialTransactions = reservation.parts.map(partHash => ({
    part: partHash,
    from: listing.seller,
    to: buyer,
    price: listing.price,
    timestamp,
    transaction: txResult.insertedId
  }));
  if (partialTransactions.length > 0) {
    await db.collection('partialtransactions').insertMany(partialTransactions);
    console.log(`Created ${partialTransactions.length} PartialTransactions`);
  }

  // Change owner of parts to buyer
  const updateParts = await db.collection('parts').updateMany(
    { _id: { $in: reservation.parts } },
    { $set: { owner: buyer, listing: null } }
  );
  console.log(`Updated ${updateParts.modifiedCount} parts to new owner ${buyer}`);

  // Remove reservation
  await db.collection('reservations').deleteOne({ _id: reservation._id });
  console.log('Reservation deleted:', reservation._id);

  res.json({ success: true, transactionId: txResult.insertedId });
});

// Get all partialtransactions for a part hash
router.get('/partialtransactions/:partHash', async (req, res) => {
  const db = await connectDB();
  const { partHash } = req.params;
  try {
    const partials = await db.collection('partialtransactions').find({ part: partHash }).toArray();
    res.json(partials);
  } catch (e) {
    console.error('GET /nfts/partialtransactions error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
