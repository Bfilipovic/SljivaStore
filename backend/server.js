import express from 'express';
import nftsRouter from './routes/nfts.js';

const app = express();

// Other middleware here

app.use('/nfts', nftsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
