import express from 'express';
import multer from 'multer';
import connectDB from '../db.js';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { verifySignature } from '../utils/verifySignature.js';


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
router.post('/mint', upload.single('imageFile'), verifySignature, async (req, res) => {
  const db = await connectDB();
  const { name, description, parts, creator } = req.verifiedData;
  const file = req.file;
  const imageurl = file ? `/uploads/${file.filename}` : req.body.imageUrl;

  if (!name || !description || !parts || !creator || !imageurl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (creator.toLowerCase() !== req.verifiedAddress.toLowerCase()) {
    console.warn('Creator does not match signer:', creator, req.verifiedAddress);
    return res.status(401).json({ error: 'Creator address mismatch' });
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
router.delete('/listings/:id', verifySignature, async (req, res) => {
  const db = await connectDB();
  const listingId = req.params.id;
  console.log("Verified data:", req.verifiedData);
  const { seller } = req.verifiedData;

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
router.post('/createTransaction', verifySignature, async (req, res) => {
  const db = await connectDB();
  const { listingId, reservationId, buyer, timestamp } = req.verifiedData;
  console.log('POST /nfts/createTransaction called with:', req.body);

  if( req.verifiedAddress.toLowerCase() !== buyer.toLowerCase()) {
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
