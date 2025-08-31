import express from 'express';
import multer from 'multer';
import connectDB from '../db.js';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { verifySignature } from '../utils/verifySignature.js';
import { yrtToEth } from "../utils/currency.js";



const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 🔧 Utility: hash content deterministically
function hashObject(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
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
  const db = await connectDB();
  const { name, description, parts, creator } = req.body;
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
    time_created: new Date(),
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

router.post('/createListing', verifySignature, async (req, res) => {

  const { price, nftId, seller, parts } = req.verifiedData;

  if (!price || !nftId || !seller || !parts || !Array.isArray(parts) || parts.length === 0) {
    console.warn('Invalid listing fields:', req.body.data);
    return res.status(400).json({ error: 'Missing or invalid listing fields' });
  }

  // Ensure seller matches the verified address
  if (seller.toLowerCase() !== req.verifiedAddress.toLowerCase()) {
    console.warn('Seller does not match signer:', seller, req.verifiedAddress);
    return res.status(401).json({ error: 'Seller address mismatch' });
  }

  try {
    const db = await connectDB();

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

    await db.collection('parts').updateMany(
      { _id: { $in: parts } },
      { $set: { listing: listingId.toString() } }
    );

    res.json({ success: true, id: listingId });
  } catch (e) {
    console.error('POST /nfts/createListing error:', e);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});


// Get all active listings
router.get('/listings', async (req, res) => {
  console.log("GET /listings called");
  const db = await connectDB();

  try {
    const listings = await db
      .collection('listings')
      .find({ status: { $ne: "DELETED" } }) // exclude deleted
      .toArray();

    res.json(listings);
  } catch (e) {
    console.error('GET /listings error:', e);
    res.status(500).json({ error: 'Failed to fetch listings!' });
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
router.delete('/listings/:id', verifySignature, async (req, res) => {
  const db = await connectDB();
  const listingId = req.params.id;
  console.log("Verified data:", req.verifiedData);
  const { seller } = req.verifiedData;

  console.log("Marking listing as DELETED:", listingId);

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

    // Free the parts (set their listing reference to null)
    if (listing.parts && listing.parts.length > 0) {
      await db.collection('parts').updateMany(
        { _id: { $in: listing.parts } },
        { $set: { listing: null } }
      );
      console.log(`Unlinked ${listing.parts.length} parts from listing ${listingId}`);
    }

    // Instead of deleting, update status
    await db.collection('listings').updateOne(
      { _id: new ObjectId(listingId) },
      { $set: { status: "DELETED" } }
    );

    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /listings/:id error:', e);
    res.status(500).json({ error: 'Failed to mark listing as deleted' });
  }
});


// Reserve parts from a listing (mutex-like reservation)
router.post('/reserve', async (req, res) => {
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

  const totalYrt = parts.length * listing.price; // price in YRT
  const totalEth = await yrtToEth(totalYrt);


  // Create reservation object
  const reservation = {
    listingId,
    reserver,
    timestamp,
    totalPriceYrt: totalYrt,
    totalPriceEth: totalEth,
    parts,
  };
  await db.collection('reservations').insertOne(reservation);
  console.log('POST /nfts/reserve success:', reservation);
  res.json({ reservation });
});

// Create a transaction after reservation and mnemonic confirmation
router.post('/createTransaction', verifySignature, async (req, res) => {
  const db = await connectDB();
  const { listingId, reservationId, buyer, timestamp, chainTx } = req.verifiedData;
  console.log('POST /nfts/createTransaction called with:', req.body);

  if (req.verifiedAddress.toLowerCase() !== buyer.toLowerCase()) {
    console.log('POST /nfts/createTransaction error: Buyer does not match verified address');
    return res.status(401).json({ error: 'Buyer address mismatch' });
  }

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
    pricePerPartYrt: listing.price,
    totalPriceYrt: reservation.totalPriceYrt,
    totalPriceEth: reservation.totalPriceEth,
    time: timestamp,
    chainTx: chainTx || null,
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
    pricePerPartYrt: listing.price,
    pricePerPartEth: reservation.totalPriceEth / reservation.parts.length,
    timestamp,
    transaction: txResult.insertedId,
    chainTx: chainTx || null, // Optional chain transaction hash
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

// POST /nfts/gift
router.post('/gift', verifySignature, async (req, res) => {
  try {
    const { giver, receiver, nftId, parts } = req.verifiedData;
    console.log('[GIFT] Request received:', { giver, receiver, nftId, parts });

    if (!giver || !receiver || !nftId || !Array.isArray(parts) || parts.length === 0) {
      console.error('[GIFT] Invalid request data');
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Ensure seller matches the verified address
    if (giver.toLowerCase() !== req.verifiedAddress.toLowerCase()) {
      console.warn('Giver does not match signer:', seller, req.verifiedAddress);
      return res.status(401).json({ error: 'Giver address mismatch' });
    }

    const db = await connectDB();
    const partsCol = db.collection('parts');
    const giftsCol = db.collection('gifts');

    // Fetch parts
    const foundParts = await partsCol.find({ _id: { $in: parts } }).toArray();
    console.log('[GIFT] Found parts:', foundParts.map(p => p._id));

    if (foundParts.length !== parts.length) {
      console.error('[GIFT] Some parts not found');
      return res.status(400).json({ error: 'Some parts not found' });
    }

    // Validate ownership + availability
    for (const p of foundParts) {
      if (p.owner !== giver) {
        console.error(`[GIFT] Ownership check failed for part ${p._id}. Owner: ${p.owner}, Expected: ${giver}`);
        return res.status(403).json({ error: `Part ${p._id} not owned by giver` });
      }
      if (p.listing) {
        console.error(`[GIFT] Part ${p._id} already has listing: ${p.listing}`);
        return res.status(400).json({ error: `Part ${p._id} already listed or gifted` });
      }
    }


    // Insert gift document
    const gift = {
      giver: giver.toLowerCase(),
      receiver: receiver.toLowerCase(),
      nftId,
      parts,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      status: 'ACTIVE'
    };
    const result = await giftsCol.insertOne(gift);
    const giftId = result.insertedId;
    console.log('[GIFT] Gift created with ID:', giftId.toString());

    // Update parts with gift reference
    const updateRes = await partsCol.updateMany(
      { _id: { $in: parts } },
      { $set: { listing: giftId.toString() } }
    );
    console.log(`[GIFT] Updated ${updateRes.modifiedCount} parts with giftId ${giftId}`);

    res.json({ success: true, giftId: giftId.toString() });
  } catch (err) {
    console.error('[GIFT] Error creating gift:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /nfts/gifts/:address
router.get('/gifts/:address', async (req, res) => {
  try {
    const { address } = req.params;
    console.log('[GIFT] Fetch request for address:', address);

    const db = await connectDB();
    const giftsCol = db.collection('gifts');

    // Only return ACTIVE and non-expired gifts
    const now = new Date();
    const gifts = await giftsCol.find({
      receiver: address.toLowerCase(),
      status: 'ACTIVE',
      expires: { $gt: now }
    }).toArray();

    console.log(`[GIFT] Found ${gifts.length} active gifts for ${address}`);
    if (gifts.length > 0) {
      console.log('[GIFT] Gift details:');
      gifts.forEach(g => {
        console.log(`  - Gift ID: ${g._id}, giver: ${g.giver}, receiver: ${g.receiver}, parts: ${g.parts}, expires: ${g.expires}, status: ${g.status}`);
      });
    }

    res.json({ success: true, gifts });
  } catch (err) {
    console.error('[GIFT] Error fetching gifts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /nfts/gift/claim
router.post('/gift/claim', verifySignature, async (req, res) => {
  try {
    const { giftId, chainTx } = req.verifiedData;
    const verifiedAddr = req.verifiedAddress;
    console.log('[GIFT CLAIM] Request received:', { giftId, chainTx, verifiedAddr });

    if (!giftId) {
      console.error('[GIFT CLAIM] Missing giftId');
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const db = await connectDB();
    const giftsCol = db.collection('gifts');
    const partsCol = db.collection('parts');
    const txCol = db.collection('transactions');
    const ptxCol = db.collection('partialtransactions'); // ✅ match collection name
    const nftsCol = db.collection('nfts');

    // Find gift
    const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
    if (!gift) {
      console.error('[GIFT CLAIM] Gift not found:', giftId);
      return res.status(404).json({ error: 'Gift not found' });
    }

    if (gift.status !== 'ACTIVE') {
      console.error('[GIFT CLAIM] Gift not active. Current status:', gift.status);
      return res.status(400).json({ error: 'Gift is not active' });
    }

    if (gift.expires <= new Date()) {
      console.error('[GIFT CLAIM] Gift expired:', giftId);
      return res.status(400).json({ error: 'Gift has expired' });
    }

    if (verifiedAddr.toLowerCase() !== gift.receiver.toLowerCase()) {
      console.error('[GIFT CLAIM] Receiver mismatch. Verified:', verifiedAddr, 'Expected:', gift.receiver);
      return res.status(401).json({ error: 'Receiver address mismatch' });
    }

    console.log('[GIFT CLAIM] Gift validated:', gift);

    // Transfer ownership of parts
    const updateRes = await partsCol.updateMany(
      { _id: { $in: gift.parts } },
      { $set: { owner: gift.receiver, listing: null } }
    );
    console.log(`[GIFT CLAIM] Updated ${updateRes.modifiedCount} parts -> new owner: ${gift.receiver}`);

    // Fetch NFT
    const nft = await nftsCol.findOne({ _id: gift.nftId });
    if (!nft) {
      console.error('[GIFT CLAIM] NFT not found:', gift.nftId);
    }

    // Get transaction number
    const txCount = await txCol.countDocuments();
    const transactionNumber = txCount + 1;
    const timestamp = new Date();

    // Prepare transaction object
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
      status: 'CONFIRMED',
    };
    const txResult = await txCol.insertOne(transaction);
    console.log('[GIFT CLAIM] Transaction created:', transaction);

    // ✅ Partial transactions (aligned with buy flow)
    const partialTransactions = gift.parts.map(partId => ({
      part: partId,
      from: gift.giver,
      to: gift.receiver,
      pricePerPartYrt: "0",
      pricePerPartEth: "0",
      timestamp,
      transaction: txResult.insertedId, // keep ObjectId ref
      chainTx: chainTx || null,
    }));

    if (partialTransactions.length > 0) {
      await ptxCol.insertMany(partialTransactions);
      console.log(`[GIFT CLAIM] Created ${partialTransactions.length} PartialTransactions`);
    }

    // ✅ Update gift status
    await giftsCol.updateOne(
      { _id: gift._id },
      { $set: { status: 'CLAIMED', claimedAt: new Date() } }
    );
    console.log('[GIFT CLAIM] Gift marked as CLAIMED:', giftId);

    res.json({ success: true, transactionId: txResult.insertedId });
  } catch (err) {
    console.error('[GIFT CLAIM] Error claiming gift:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /nfts/gift/refuse
router.post('/gift/refuse', verifySignature, async (req, res) => {
  try {
    const { giftId } = req.verifiedData;
    const verifiedAddr = req.verifiedAddress;
    console.log('[GIFT REFUSE] Request received:', { giftId, verifiedAddr });

    if (!giftId) {
      console.error('[GIFT REFUSE] Missing giftId');
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const db = await connectDB();
    const giftsCol = db.collection('gifts');
    const partsCol = db.collection('parts');

    // Find gift
    const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
    if (!gift) {
      console.error('[GIFT REFUSE] Gift not found:', giftId);
      return res.status(404).json({ error: 'Gift not found' });
    }

    // Check expiration
    if (gift.expires <= new Date()) {
      console.error('[GIFT REFUSE] Gift expired:', giftId);
      return res.status(400).json({ error: 'Gift has expired' });
    }

    // Verify receiver
    if (verifiedAddr.toLowerCase() !== gift.receiver.toLowerCase()) {
      console.error('[GIFT REFUSE] Receiver mismatch. Verified:', verifiedAddr, 'Expected:', gift.receiver);
      return res.status(401).json({ error: 'Receiver address mismatch' });
    }

    // Status must be ACTIVE
    if (gift.status !== 'ACTIVE') {
      console.error('[GIFT REFUSE] Gift not active. Current status:', gift.status);
      return res.status(400).json({ error: 'Gift is not active' });
    }

    // ✅ Update gift status
    await giftsCol.updateOne(
      { _id: gift._id },
      { $set: { status: 'REFUSED', refusedAt: new Date() } }
    );
    console.log('[GIFT REFUSE] Gift marked as REFUSED:', giftId);

    // ✅ Unlock parts (set listing back to null)
    const updateRes = await partsCol.updateMany(
      { _id: { $in: gift.parts } },
      { $set: { listing: null } }
    );
    console.log(`[GIFT REFUSE] Updated ${updateRes.modifiedCount} parts -> listing reset to null`);

    res.json({ success: true });
  } catch (err) {
    console.error('[GIFT REFUSE] Error refusing gift:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



export default router;
