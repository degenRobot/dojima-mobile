/**
 * Test to verify viem imports are working correctly
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex, Address } from 'viem';

describe('Viem Import Tests', () => {
  test('generatePrivateKey should be a function', () => {
    expect(typeof generatePrivateKey).toBe('function');
  });

  test('generatePrivateKey should generate a valid private key', () => {
    const privateKey = generatePrivateKey();
    expect(privateKey).toBeTruthy();
    expect(privateKey.startsWith('0x')).toBe(true);
    expect(privateKey.length).toBe(66); // 0x + 64 hex chars
  });

  test('privateKeyToAccount should create an account from private key', () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    expect(account).toBeTruthy();
    expect(account.address).toBeTruthy();
    expect(account.address.startsWith('0x')).toBe(true);
    expect(account.address.length).toBe(42); // 0x + 40 hex chars
  });

  test('account should have required methods', () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    expect(typeof account.sign).toBe('function');
    expect(typeof account.signMessage).toBe('function');
    expect(typeof account.signTypedData).toBe('function');
  });
});