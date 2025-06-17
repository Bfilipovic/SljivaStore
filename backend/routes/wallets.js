import express from 'express';
import { ObjectId } from 'mongodb';
import connectDB from '../db.js';

const router = express.Router();

router.get('/:address/balance', async (req, res) => {
  try {
    const address = req.params.address;
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545'); // Hardhat

    const balance = await provider.getBalance(address);
    const eth = ethers.formatEther(balance);

    res.json({ balance: eth });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

export default router;
