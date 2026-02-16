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
        // Return 503 if it's a service unavailable error, otherwise 500
        const statusCode = err.statusCode || (err.code === 'SERVICE_UNAVAILABLE' ? 503 : 500);
        res.status(statusCode).json({ error: err.message });
    }
});

// GET /api/eth/gas-price
router.get("/gas-price", async (req, res) => {
    try {
        const data = await getGasPriceData();
        res.json(data);
    } catch (err) {
        console.error("[GET /api/eth/gas-price] Error:", err);
        // Return 503 if it's a service unavailable error, otherwise 500
        const statusCode = err.statusCode || (err.code === 'SERVICE_UNAVAILABLE' ? 503 : 500);
        res.status(statusCode).json({ error: err.message });
    }
});

// GET /api/eth/nonce/:address
router.get("/nonce/:address", async (req, res) => {
    try {
        const nonce = await getNonce(req.params.address);
        res.json({ nonce });
    } catch (err) {
        console.error("[GET /api/eth/nonce] Error:", err);
        // Return 503 if it's a service unavailable error, otherwise 500
        const statusCode = err.statusCode || (err.code === 'SERVICE_UNAVAILABLE' ? 503 : 500);
        res.status(statusCode).json({ error: err.message });
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
        // Return 503 if it's a service unavailable error, otherwise 500
        const statusCode = err.statusCode || (err.code === 'SERVICE_UNAVAILABLE' ? 503 : 500);
        res.status(statusCode).json({ error: err.message });
    }
});

export default router;
