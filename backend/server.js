import express from 'express';
import nftsRouter from './routes/nfts.js';
import walletsRouter from './routes/wallets.js'
import multer from 'multer';
import connectDB from './db.js';
import { ObjectId } from 'mongodb';
import { cleanupOldSignatures } from './utils/verifySignature.js';
import cors from 'cors';
import path from 'path';


const app = express();


app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Place CSP header middleware right here:
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://static.wikia.nocookie.net data:; media-src 'self'; style-src 'unsafe-inline';"
  );
  next();
});

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001", // allow only your frontend
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

// Other middleware here
app.use(express.json());

app.use('/nfts', nftsRouter);

app.use('/wallets', walletsRouter); 

app.use('/uploads', express.static('uploads'));

// Periodic cleanup of expired reservations
async function cleanupExpiredReservations() {
  const db = await connectDB();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 4 * 60 * 1000); // 4 minutes ago
  const expired = await db.collection('reservations').find({ timestamp: { $lt: cutoff } }).toArray();
  if (expired.length > 0) {
    console.log(`Cleaning up ${expired.length} expired reservations...`);
  }
  for (const reservation of expired) {
    // Restore parts to the listing
    const listingId = reservation.listingId;
    const parts = reservation.parts || [];
    await db.collection('listings').updateOne(
      { _id: typeof listingId === 'string' ? new ObjectId(listingId) : listingId },
      { $push: { parts: { $each: parts } } }
    );
    // Delete the reservation
    await db.collection('reservations').deleteOne({ _id: reservation._id });
    console.log(`Expired reservation ${reservation._id} deleted and parts restored.`);
  }
}

setInterval(cleanupExpiredReservations, 30 * 1000); // every 30 seconds

setInterval(cleanupOldSignatures, 10 * 60 * 1000); // every 10 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

