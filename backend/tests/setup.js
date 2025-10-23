// tests/setup.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');

let mongoServer;
let client;
let db;

// Setup before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db('test');
  
  // Set global db for tests
  global.testDb = db;
});

// Cleanup after all tests
afterAll(async () => {
  await client.close();
  await mongoServer.stop();
});

// Clear database between tests
beforeEach(async () => {
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
});

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    address: '0x1234567890123456789012345678901234567890',
    signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    message: 'Test message'
  }),
  
  createMockNFT: () => ({
    _id: 'test-nft-id',
    name: 'Test NFT',
    description: 'Test NFT Description',
    imageurl: 'https://example.com/image.jpg',
    owner: '0x1234567890123456789012345678901234567890',
    hash: 'test-nft-hash',
    timestamp: Date.now()
  }),
  
  createMockPart: () => ({
    _id: 'test-part-id',
    parent_hash: 'test-nft-hash',
    owner: '0x1234567890123456789012345678901234567890',
    metadata: { name: 'Test Part', description: 'Test Part Description' },
    timestamp: Date.now()
  }),
  
  createMockTransaction: () => ({
    _id: 'test-tx-id',
    from: '0x1234567890123456789012345678901234567890',
    to: '0x0987654321098765432109876543210987654321',
    amount: '0.1',
    currency: 'ETH',
    transaction: 'test-tx-hash',
    chainTx: 'test-chain-tx-hash',
    timestamp: Date.now()
  })
};
