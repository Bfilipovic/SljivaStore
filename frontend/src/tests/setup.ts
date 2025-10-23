// src/tests/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock SvelteKit stores
vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(() => () => {}),
    params: {},
    url: new URL('http://localhost:3000')
  },
  navigating: {
    subscribe: vi.fn(() => () => {})
  }
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock crypto for wallet operations
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

// Global test utilities
global.testUtils = {
  createMockWallet: () => ({
    address: '0x1234567890123456789012345678901234567890',
    mnemonic: 'test mnemonic phrase with twelve words for testing purposes only',
    balance: '1.5'
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
  
  mockApiResponse: (data: any, ok = true) => ({
    ok,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  })
};
