// backend/routes/eth.js
import express from "express";
import { 
    getETHBalance,
    getGasPriceData,
    getNonce,
    broadcastTransaction
} from "../services/ethService.js";

const router = express.Router();

// GET /api/eth/balance/:address
router.get("/balance/:address", async (req, res) => {
    try {
        const balance = await getETHBalance(req.params.address);
        res.json({ balance });
    } catch (err) {
        console.error("[GET /api/eth/balance] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/eth/gas-price
router.get("/gas-price", async (req, res) => {
    try {
        const data = await getGasPriceData();
        res.json(data);
    } catch (err) {
        console.error("[GET /api/eth/gas-price] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/eth/nonce/:address
router.get("/nonce/:address", async (req, res) => {
    try {
        const nonce = await getNonce(req.params.address);
        res.json({ nonce });
    } catch (err) {
        console.error("[GET /api/eth/nonce] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/eth/transaction
router.post("/transaction", async (req, res) => {
    try {
        const { signedTransaction } = req.body;
        
        if (!signedTransaction) {
            return res.status(400).json({ error: 'Missing signed transaction' });
        }

        const txHash = await broadcastTransaction(signedTransaction);
        
        res.json({ 
            success: true, 
            txHash
        });
    } catch (err) {
        console.error("[POST /api/eth/transaction] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
