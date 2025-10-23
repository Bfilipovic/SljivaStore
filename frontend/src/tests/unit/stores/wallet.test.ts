// src/tests/unit/stores/wallet.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { wallet, UserWallet } from '$lib/stores/wallet';

describe('Wallet Store', () => {
  beforeEach(() => {
    // Reset wallet to initial state
    wallet.set(new UserWallet());
  });

  describe('UserWallet class', () => {
    it('should initialize with default values', () => {
      const userWallet = new UserWallet();
      
      expect(userWallet.selectedCurrency).toBe('ETH');
      expect(userWallet.selectedAddress).toBeNull();
      expect(userWallet.selectedBalance).toBe('0');
      expect(userWallet.addresses).toEqual([]);
      expect(userWallet.balances).toEqual([]);
      expect(userWallet.isAdmin).toBe(false);
    });

    it('should update selected address and balance', () => {
      const userWallet = new UserWallet();
      
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      userWallet.setBalance('ETH', '1.5');
      
      expect(userWallet.selectedAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(userWallet.selectedBalance).toBe('1.5');
      expect(userWallet.ethAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(userWallet.ethBalance).toBe('1.5');
    });

    it('should switch selected currency', () => {
      const userWallet = new UserWallet();
      
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      userWallet.setBalance('ETH', '1.5');
      userWallet.setAddress('SOL', '0x0987654321098765432109876543210987654321');
      userWallet.setBalance('SOL', '2.0');
      
      userWallet.setSelectedCurrency('SOL');
      
      expect(userWallet.selectedCurrency).toBe('SOL');
      expect(userWallet.selectedAddress).toBe('0x0987654321098765432109876543210987654321');
      expect(userWallet.selectedBalance).toBe('2.0');
    });

    it('should set admin status', () => {
      const userWallet = new UserWallet();
      
      userWallet.setAdmin(true);
      expect(userWallet.isAdmin).toBe(true);
      
      userWallet.setAdmin(false);
      expect(userWallet.isAdmin).toBe(false);
    });

    it('should set gifts', () => {
      const userWallet = new UserWallet();
      const mockGifts = [{ id: 1, name: 'Test Gift' }];
      
      userWallet.setGifts(mockGifts);
      expect(userWallet.gifts).toEqual(mockGifts);
    });
  });

  describe('wallet store', () => {
    it('should have initial empty state', () => {
      const walletState = get(wallet);
      
      expect(walletState.selectedCurrency).toBe('ETH');
      expect(walletState.selectedAddress).toBeNull();
      expect(walletState.selectedBalance).toBe('0');
      expect(walletState.addresses).toEqual([]);
      expect(walletState.balances).toEqual([]);
    });

    it('should update when wallet is modified', () => {
      const userWallet = new UserWallet();
      userWallet.setAddress('ETH', '0x1234567890123456789012345678901234567890');
      userWallet.setBalance('ETH', '1.5');
      
      wallet.set(userWallet);
      
      const walletState = get(wallet);
      expect(walletState.selectedAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(walletState.selectedBalance).toBe('1.5');
    });
  });
});
