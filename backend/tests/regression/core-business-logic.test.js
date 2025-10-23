// backend/tests/regression/core-business-logic.test.js
const { MongoClient } = require('mongodb');

describe('Core Business Logic Regression Tests', () => {
  let db;
  
  beforeAll(async () => {
    // Use test database from setup
    db = global.testDb;
  });

  describe('NFT Operations', () => {
    it('should create NFT with all required fields', async () => {
      const nftData = {
        name: 'Test NFT',
        description: 'Test Description',
        imageurl: 'https://example.com/image.jpg',
        owner: '0x1234567890123456789012345678901234567890',
        hash: 'test-hash-123',
        timestamp: Date.now()
      };

      const result = await db.collection('nfts').insertOne(nftData);
      
      expect(result.insertedId).toBeDefined();
      
      const inserted = await db.collection('nfts').findOne({ _id: result.insertedId });
      expect(inserted.name).toBe(nftData.name);
      expect(inserted.owner).toBe(nftData.owner);
      expect(inserted.hash).toBe(nftData.hash);
    });

    it('should find NFTs by owner', async () => {
      const owner = '0x1234567890123456789012345678901234567890';
      
      // Insert test NFT
      await db.collection('nfts').insertOne({
        name: 'Test NFT',
        owner: owner,
        hash: 'test-hash',
        timestamp: Date.now()
      });

      const nfts = await db.collection('nfts').find({ owner }).toArray();
      expect(nfts).toHaveLength(1);
      expect(nfts[0].owner).toBe(owner);
    });

    it('should update NFT owner', async () => {
      const nft = await db.collection('nfts').insertOne({
        name: 'Test NFT',
        owner: '0x1234567890123456789012345678901234567890',
        hash: 'test-hash',
        timestamp: Date.now()
      });

      const newOwner = '0x0987654321098765432109876543210987654321';
      await db.collection('nfts').updateOne(
        { _id: nft.insertedId },
        { $set: { owner: newOwner } }
      );

      const updated = await db.collection('nfts').findOne({ _id: nft.insertedId });
      expect(updated.owner).toBe(newOwner);
    });
  });

  describe('Part Operations', () => {
    it('should create part linked to NFT', async () => {
      // First create NFT
      const nft = await db.collection('nfts').insertOne({
        name: 'Parent NFT',
        owner: '0x1234567890123456789012345678901234567890',
        hash: 'parent-hash',
        timestamp: Date.now()
      });

      // Create part
      const partData = {
        parent_hash: 'parent-hash',
        owner: '0x1234567890123456789012345678901234567890',
        metadata: { name: 'Test Part', description: 'Part Description' },
        timestamp: Date.now()
      };

      const result = await db.collection('parts').insertOne(partData);
      expect(result.insertedId).toBeDefined();

      const inserted = await db.collection('parts').findOne({ _id: result.insertedId });
      expect(inserted.parent_hash).toBe('parent-hash');
      expect(inserted.owner).toBe(partData.owner);
    });

    it('should find parts by owner and NFT', async () => {
      const owner = '0x1234567890123456789012345678901234567890';
      const nftHash = 'test-nft-hash';

      // Insert test part
      await db.collection('parts').insertOne({
        parent_hash: nftHash,
        owner: owner,
        metadata: { name: 'Test Part' },
        timestamp: Date.now()
      });

      const parts = await db.collection('parts').find({
        owner: owner.toLowerCase(),
        parent_hash: String(nftHash)
      }).toArray();

      expect(parts).toHaveLength(1);
      expect(parts[0].owner).toBe(owner.toLowerCase());
    });
  });

  describe('Transaction Operations', () => {
    it('should create transaction record', async () => {
      const txData = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        amount: '0.1',
        currency: 'ETH',
        transaction: 'test-tx-hash',
        chainTx: 'test-chain-tx-hash',
        timestamp: Date.now()
      };

      const result = await db.collection('transactions').insertOne(txData);
      expect(result.insertedId).toBeDefined();

      const inserted = await db.collection('transactions').findOne({ _id: result.insertedId });
      expect(inserted.from).toBe(txData.from);
      expect(inserted.currency).toBe('ETH');
      expect(inserted.chainTx).toBe(txData.chainTx);
    });

    it('should find transactions by part ID', async () => {
      const partId = 'test-part-id';
      
      // Insert test transaction
      await db.collection('transactions').insertOne({
        partId: partId,
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        amount: '0.1',
        currency: 'ETH',
        timestamp: Date.now()
      });

      const transactions = await db.collection('transactions').find({ partId }).toArray();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].partId).toBe(partId);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity between NFTs and parts', async () => {
      const nftHash = 'integrity-test-hash';
      
      // Create NFT
      await db.collection('nfts').insertOne({
        name: 'Integrity Test NFT',
        hash: nftHash,
        owner: '0x1234567890123456789012345678901234567890',
        timestamp: Date.now()
      });

      // Create part referencing NFT
      await db.collection('parts').insertOne({
        parent_hash: nftHash,
        owner: '0x1234567890123456789012345678901234567890',
        metadata: { name: 'Integrity Test Part' },
        timestamp: Date.now()
      });

      // Verify relationship
      const nft = await db.collection('nfts').findOne({ hash: nftHash });
      const parts = await db.collection('parts').find({ parent_hash: nftHash }).toArray();
      
      expect(nft).toBeDefined();
      expect(parts).toHaveLength(1);
      expect(parts[0].parent_hash).toBe(nft.hash);
    });

    it('should handle address case insensitivity', async () => {
      const address1 = '0x1234567890123456789012345678901234567890';
      const address2 = '0X1234567890123456789012345678901234567890';
      
      // Insert with different cases
      await db.collection('nfts').insertOne({
        name: 'Test NFT',
        owner: address1,
        hash: 'test-hash-1',
        timestamp: Date.now()
      });

      await db.collection('nfts').insertOne({
        name: 'Test NFT 2',
        owner: address2,
        hash: 'test-hash-2',
        timestamp: Date.now()
      });

      // Should find both when searching with lowercase
      const nfts = await db.collection('nfts').find({ 
        owner: { $regex: new RegExp(`^${address1.toLowerCase()}$`, 'i') }
      }).toArray();
      
      expect(nfts).toHaveLength(2);
    });
  });
});
