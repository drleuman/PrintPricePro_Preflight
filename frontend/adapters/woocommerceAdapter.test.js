import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const adapter = require('./woocommerceAdapter');

const makeConfig = () => ({
  baseUrl: 'https://example.myshopify.com',
  apiKey: 'ck_test_abc123',
});

describe('WooCommerceAdapter', () => {
  describe('fetchOrder', () => {
    it('returns an order object with the requested orderId', async () => {
      const order = await adapter.fetchOrder('42', makeConfig());
      expect(order.id).toBe('42');
    });

    it('returns an order_number derived from the orderId', async () => {
      const order = await adapter.fetchOrder('100', makeConfig());
      expect(order.order_number).toBe('WC-100');
    });

    it('returns a status field', async () => {
      const order = await adapter.fetchOrder('1', makeConfig());
      expect(typeof order.status).toBe('string');
    });

    it('returns metadata with pages and trim dimensions', async () => {
      const order = await adapter.fetchOrder('7', makeConfig());
      expect(order.metadata).toBeDefined();
      expect(order.metadata.pages).toBeDefined();
      expect(order.metadata.trim).toBeDefined();
      expect(order.metadata.trim).toHaveProperty('widthMm');
      expect(order.metadata.trim).toHaveProperty('heightMm');
    });

    it('returns a quantity field', async () => {
      const order = await adapter.fetchOrder('5', makeConfig());
      expect(typeof order.quantity).toBe('number');
    });

    it('returns a product_type field', async () => {
      const order = await adapter.fetchOrder('3', makeConfig());
      expect(typeof order.product_type).toBe('string');
    });

    it('resolves for any orderId (stub behavior)', async () => {
      await expect(adapter.fetchOrder('999', makeConfig())).resolves.toBeDefined();
      await expect(adapter.fetchOrder('0', makeConfig())).resolves.toBeDefined();
    });
  });

  describe('updateOrderStatus', () => {
    it('resolves to { success: true }', async () => {
      const result = await adapter.updateOrderStatus('42', 'completed', makeConfig());
      expect(result).toEqual({ success: true });
    });

    it('accepts any status string', async () => {
      await expect(adapter.updateOrderStatus('1', 'processing', makeConfig())).resolves.toEqual({ success: true });
      await expect(adapter.updateOrderStatus('1', 'cancelled', makeConfig())).resolves.toEqual({ success: true });
    });

    it('is an async function', () => {
      expect(adapter.updateOrderStatus('1', 'done', makeConfig())).toBeInstanceOf(Promise);
    });
  });
});
