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

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// CSP header
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://static.wikia.nocookie.net data:; media-src 'self'; style-src 'unsafe-inline';"
  );
  next();
});

// CORS
if (process.env.NODE_ENV === "development") {
  app.use(cors()); // allow all in dev
} else {
  app.use(cors({ origin: process.env.FRONTEND_URL }));
}

app.use(express.json());

// Routers
app.use('/nfts', nftsRouter);
app.use('/wallets', walletsRouter); 
app.use('/uploads', express.static('uploads'));

// Background jobs
setInterval(cleanupExpiredReservations, 30 * 1000);   // every 30s
setInterval(cleanupOldSignatures, 10 * 60 * 1000);    // every 10min
setInterval(cleanupExpiredGifts, 10 * 60 * 1000);     // every 10min

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
