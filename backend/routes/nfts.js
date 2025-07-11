import express from 'express';
import multer from 'multer';
import connectDB from '../db.js';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';


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

//Create a listing
router.post('/createListing', async (req, res) => {
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

    // Delete the listing
    await db.collection('listings').deleteOne({ _id: new ObjectId(listingId) });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /listings/:id error:', e);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});


export default router;
