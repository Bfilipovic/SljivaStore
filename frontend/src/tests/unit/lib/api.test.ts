// src/tests/unit/lib/api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiFetch } from '$lib/api';

describe('API Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiFetch', () => {
    it('should make GET request successfully', async () => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const result = await apiFetch('/test');
      
      expect(global.fetch).toHaveBeenCalledWith('/api/test', {});
      expect(result.ok).toBe(true);
    });

    it('should make POST request with data', async () => {
      const mockData = { name: 'Test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await apiFetch('/test', {
        method: 'POST',
        body: JSON.stringify(mockData)
      });
      
      expect(global.fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify(mockData)
      });
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(apiFetch('/nonexistent')).rejects.toThrow('API error 404: Not Found');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(apiFetch('/test')).rejects.toThrow('Network error');
    });
  });
});
