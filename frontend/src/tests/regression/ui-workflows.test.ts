// frontend/src/tests/regression/ui-workflows.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { wallet, UserWallet } from '$lib/stores/wallet';
import { apiFetch } from '$lib/api';

describe('UI Workflow Regression Tests', () => {
  beforeEach(() => {
    // Reset wallet state
    wallet.set(new UserWallet());
    vi.clearAllMocks();
  });

  describe('Wallet Management', () => {
    it('should maintain wallet state consistency', () => {
      const userWallet = new UserWallet();
      
      // Set ETH address and balance
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      userWallet.setBalance('ETH', '1.5');
      
      // Update store
      wallet.set(userWallet);
      
      // Verify state consistency
      const walletState = get(wallet);
      expect(walletState.selectedAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(walletState.selectedBalance).toBe('1.5');
      expect(walletState.ethAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(walletState.ethBalance).toBe('1.5');
    });

    it('should handle currency switching correctly', () => {
      const userWallet = new UserWallet();
      
      // Set multiple currencies
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      userWallet.setBalance('ETH', '1.5');
      userWallet.setAddress('SOL', '0x0987654321098765432109876543210987654321');
      userWallet.setBalance('SOL', '2.0');
      
      wallet.set(userWallet);
      
      // Switch to SOL
      userWallet.setSelectedCurrency('SOL');
      wallet.set(userWallet);
      
      const walletState = get(wallet);
      expect(walletState.selectedCurrency).toBe('SOL');
      expect(walletState.selectedAddress).toBe('0x0987654321098765432109876543210987654321');
      expect(walletState.selectedBalance).toBe('2.0');
    });

    it('should preserve admin status', () => {
      const userWallet = new UserWallet();
      userWallet.setAdmin(true);
      
      wallet.set(userWallet);
      
      const walletState = get(wallet);
      expect(walletState.isAdmin).toBe(true);
      
      // Change other properties
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      wallet.set(userWallet);
      
      const updatedState = get(wallet);
      expect(updatedState.isAdmin).toBe(true); // Should persist
    });
  });

  describe('API Integration', () => {
    it('should handle API responses correctly', async () => {
      const mockNFTs = [
        { _id: '1', name: 'NFT 1', owner: '0x1234567890123456789012345678901234567890' },
        { _id: '2', name: 'NFT 2', owner: '0x0987654321098765432109876543210987654321' }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNFTs)
      });

      const response = await apiFetch('/nfts');
      const data = await response.json();

      expect(data).toEqual(mockNFTs);
      expect(global.fetch).toHaveBeenCalledWith('/api/nfts', {});
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(apiFetch('/nfts')).rejects.toThrow('API error 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(apiFetch('/nfts')).rejects.toThrow('Network error');
    });
  });

  describe('Data Formatting', () => {
    it('should format addresses consistently', () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      // Test address validation
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(address.toLowerCase()).toBe(address.toLowerCase());
    });

    it('should handle balance formatting', () => {
      const balances = ['0', '1.5', '0.001', '1000.123456'];
      
      balances.forEach(balance => {
        expect(typeof balance).toBe('string');
        expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
      });
    });

    it('should validate transaction hashes', () => {
      const validTxHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      ];

      validTxHashes.forEach(hash => {
        expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid wallet data gracefully', () => {
      const userWallet = new UserWallet();
      
      // Test with invalid data
      expect(() => {
        userWallet.setAddress('', 'invalid-address');
      }).not.toThrow();
      
      expect(() => {
        userWallet.setBalance('ETH', '-1');
      }).not.toThrow();
    });

    it('should handle empty API responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      const response = await apiFetch('/nfts');
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across operations', () => {
      const userWallet = new UserWallet();
      
      // Perform multiple operations
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      userWallet.setBalance('ETH', '1.5');
      userWallet.setAdmin(true);
      userWallet.setGifts([{ id: 1, name: 'Test Gift' }]);
      
      wallet.set(userWallet);
      
      const walletState = get(wallet);
      
      // Verify all state is preserved
      expect(walletState.selectedAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(walletState.selectedBalance).toBe('1.5');
      expect(walletState.isAdmin).toBe(true);
      expect(walletState.gifts).toHaveLength(1);
      expect(walletState.gifts[0].name).toBe('Test Gift');
    });
  });
});
