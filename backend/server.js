import express from 'express';
import nftsRouter from './routes/nfts.js';
import walletsRouter from './routes/wallets.js';
import cors from 'cors';
import path from 'path';
import { 
  cleanupExpiredReservations, 
  cleanupExpiredGifts, 
  cleanupOldSignatures 
} from './cleanup.js';

const app = express();

// Serve uploads (still useful for local direct access if needed)
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// CSP header
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://static.wikia.nocookie.net data:; media-src 'self'; style-src 'unsafe-inline';"
  );
  next();
});

// ✅ Always allow CORS
// In production, frontend and backend are same-origin (via nginx).
// In dev, frontend:5173 → backend:3000 still needs CORS open.
app.use(cors());

app.use(express.json());

// Routers (all mounted under /api/*)
app.use('/api/nfts', nftsRouter);
app.use('/api/wallets', walletsRouter);

 // /api/uploads is already mounted above

// Background jobs
setInterval(cleanupExpiredReservations, 30 * 1000);   // every 30s
setInterval(cleanupOldSignatures, 10 * 60 * 1000);    // every 10min
setInterval(cleanupExpiredGifts, 10 * 60 * 1000);     // every 10min

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
