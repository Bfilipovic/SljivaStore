import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const db = await connectDB();
  const nfts = await db.collection('nfts').find({ }).toArray();
  res.json(nfts);
});

router.get('/:id', async (req, res) => {
  const db = await connectDB();
  const id = req.params.id;

  try {
    const nft = await db.collection('nfts').findOne({ _id: new ObjectId(id) });
    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }
    res.json(nft);
  } catch (error) {
    console.error('Error fetching NFT by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /nfts/owner/:ownerAddress
router.get('/owner/:ownerAddress', async (req, res) => {
  const db = await connectDB();
  const ownerAddress = req.params.ownerAddress.toLowerCase();
  console.log("fetching nfrs for owner "+ownerAddress)

  try {
    const nfts = await db.collection('nfts')
      .find({ owner: ownerAddress })
      .toArray();

    res.json(nfts);
  } catch (error) {
    console.error('Error fetching NFTs by owner:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;
