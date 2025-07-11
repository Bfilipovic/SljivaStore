import express from 'express';
import nftsRouter from './routes/nfts.js';
import walletsRouter from './routes/wallets.js'
import multer from 'multer';


const app = express();

// Other middleware here
app.use(express.json());

app.use('/nfts', nftsRouter);

app.use('/wallets', walletsRouter); 

app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
