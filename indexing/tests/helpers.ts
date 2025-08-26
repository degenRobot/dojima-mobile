import { GraphQLClient } from 'graphql-request';
import { formatUnits } from 'viem';
import { expect } from 'vitest';

export const TEST_MARKET_ADDRESS = '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222';
export const TEST_TRADER_ADDRESS = '0xcc86703cc131f65742ca555bab3d7e73a41635c4';

export function createTestClient(url = 'http://localhost:42069') {
  return new GraphQLClient(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function formatPrice(priceWei: string, decimals = 18): number {
  return Number(formatUnits(BigInt(priceWei), decimals));
}

export function formatAmount(amountWei: string, decimals = 18): number {
  return Number(formatUnits(BigInt(amountWei), decimals));
}

export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function validateBigIntString(value: string): boolean {
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
}

export async function waitForBlock(client: GraphQLClient, targetBlock: number, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await client.request<{
        _meta: { status: { rise: { block: { number: number } } } };
      }>(`{ _meta { status } }`);
      
      const currentBlock = response._meta.status.rise.block.number;
      if (currentBlock >= targetBlock) {
        return currentBlock;
      }
    } catch (error) {
      // Ignore errors during polling
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Failed to reach block ${targetBlock} after ${maxAttempts} attempts`);
}

export function generateTestOrder(overrides: Partial<{
  orderId: string;
  trader: string;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  status: string;
}> = {}) {
  return {
    orderId: overrides.orderId || Math.floor(Math.random() * 1000000).toString(),
    trader: overrides.trader || TEST_TRADER_ADDRESS,
    isBuy: overrides.isBuy ?? Math.random() > 0.5,
    price: (overrides.price ?? BigInt(2000 + Math.floor(Math.random() * 1000)) * BigInt(10 ** 18)).toString(),
    amount: (overrides.amount ?? BigInt(Math.floor(Math.random() * 100) + 1) * BigInt(10 ** 17)).toString(),
    status: overrides.status || 'ACTIVE',
  };
}

export function generateTestTrade(overrides: Partial<{
  buyOrderId: string;
  sellOrderId: string;
  price: bigint;
  amount: bigint;
  buyer: string;
  seller: string;
}> = {}) {
  return {
    buyOrderId: overrides.buyOrderId || Math.floor(Math.random() * 1000000).toString(),
    sellOrderId: overrides.sellOrderId || Math.floor(Math.random() * 1000000).toString(),
    price: (overrides.price ?? BigInt(2500) * BigInt(10 ** 18)).toString(),
    amount: (overrides.amount ?? BigInt(10) * BigInt(10 ** 17)).toString(),
    buyer: overrides.buyer || TEST_TRADER_ADDRESS,
    seller: overrides.seller || '0xdd870fa1b7c4700f2bd7f44238821c26f7392148',
  };
}

// Assertion helpers
export function assertValidOrder(order: any) {
  expect(order).toBeDefined();
  expect(order.id).toBeDefined();
  expect(validateBigIntString(order.price)).toBe(true);
  expect(validateBigIntString(order.originalAmount)).toBe(true);
  expect(validateBigIntString(order.filledAmount)).toBe(true);
  expect(['ACTIVE', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED']).toContain(order.status);
}

export function assertValidTrade(trade: any) {
  expect(trade).toBeDefined();
  expect(trade.id).toBeDefined();
  expect(validateBigIntString(trade.price)).toBe(true);
  expect(validateBigIntString(trade.amount)).toBe(true);
  expect(trade.timestamp).toBeGreaterThan(0);
  
  if (trade.buyer?.address) {
    expect(validateEthereumAddress(trade.buyer.address)).toBe(true);
  }
  if (trade.seller?.address) {
    expect(validateEthereumAddress(trade.seller.address)).toBe(true);
  }
}

export function assertValidBalance(balance: any) {
  expect(balance).toBeDefined();
  expect(validateBigIntString(balance.available)).toBe(true);
  expect(validateBigIntString(balance.locked)).toBe(true);
  expect(validateBigIntString(balance.total)).toBe(true);
  
  // Verify total = available + locked
  const total = BigInt(balance.total);
  const available = BigInt(balance.available);
  const locked = BigInt(balance.locked);
  expect(total).toBe(available + locked);
}