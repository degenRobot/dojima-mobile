/**
 * Contract-specific decimal handling for UnifiedCLOB
 * 
 * IMPORTANT: UnifiedCLOB contract ALWAYS expects:
 * 1. Base amounts to be normalized to 18 decimals
 * 2. Prices to be in quote token's native decimals
 * 3. Formula: quoteAmount = (amount * price) / 10^18
 */

import { TOKEN_DECIMALS } from './decimals';
import { TRADING_BOOKS } from '../config/contracts';

/**
 * Format amount for UnifiedCLOB contract
 * The contract expects base amounts normalized to 18 decimals
 * 
 * @param humanAmount - Human readable amount (e.g., 0.01 for 0.01 WBTC)
 * @param token - Token symbol
 * @returns Amount normalized to 18 decimals for contract
 */
export function formatAmountForContract(humanAmount: number, token: string): bigint {
  // Always scale to 18 decimals for the contract
  // This ensures the division by 10^18 in the contract works correctly
  return BigInt(Math.floor(humanAmount * 10 ** 18));
}

/**
 * Format price for UnifiedCLOB contract
 * Prices should be in quote token's native decimals
 * 
 * @param humanPrice - Human readable price
 * @param quoteToken - Quote token symbol
 * @returns Price in quote token decimals
 */
export function formatPriceForContract(humanPrice: number, quoteToken: string): bigint {
  const decimals = TOKEN_DECIMALS[quoteToken];
  if (decimals === undefined) {
    throw new Error(`Unknown quote token: ${quoteToken}`);
  }
  return BigInt(Math.floor(humanPrice * 10 ** decimals));
}

/**
 * Format an order for UnifiedCLOB contract with proper decimal handling
 * 
 * @param bookId - Trading book ID
 * @param isBuy - true for buy, false for sell
 * @param humanPrice - Human readable price
 * @param humanAmount - Human readable amount
 * @returns Formatted order parameters for contract
 */
export function formatOrderForContract(
  bookId: number,
  isBuy: boolean,
  humanPrice: number,
  humanAmount: number
) {
  const book = TRADING_BOOKS.find(b => b.id === bookId);
  if (!book) {
    throw new Error(`Invalid book ID: ${bookId}`);
  }
  
  // Amount is ALWAYS normalized to 18 decimals for the contract
  const amount = formatAmountForContract(humanAmount, book.base);
  
  // Price is in quote token's native decimals
  const price = formatPriceForContract(humanPrice, book.quote);
  
  // Calculate quote amount needed (for validation)
  const quoteAmount = (amount * price) / BigInt(10 ** 18);
  
  console.log(`📊 Formatting order for ${book.symbol} (Contract):`);
  console.log(`   Human: ${humanAmount} ${book.base} @ ${humanPrice} ${book.quote}`);
  console.log(`   Contract amount: ${amount} (normalized to 18 decimals)`);
  console.log(`   Contract price: ${price} (${book.quote} decimals: ${book.quoteDecimals})`);
  console.log(`   Quote needed: ${quoteAmount} (${book.quote} smallest unit)`);
  
  return { 
    amount, 
    price, 
    quoteAmount,
    book 
  };
}

/**
 * Parse amount from contract (18 decimals) back to token's native decimals
 * 
 * @param contractAmount - Amount from contract (18 decimals)
 * @param token - Token symbol
 * @returns Amount in token's native decimals
 */
export function parseAmountFromContract(contractAmount: bigint, token: string): bigint {
  const decimals = TOKEN_DECIMALS[token];
  if (decimals === undefined) {
    throw new Error(`Unknown token: ${token}`);
  }
  
  // Convert from 18 decimals to token's native decimals
  if (decimals === 18) {
    return contractAmount;
  } else if (decimals < 18) {
    // Scale down from 18 to token decimals
    const scaleFactor = BigInt(10 ** (18 - decimals));
    return contractAmount / scaleFactor;
  } else {
    // This shouldn't happen with standard tokens
    throw new Error(`Unexpected decimal count ${decimals} for ${token}`);
  }
}

/**
 * Convert amount from token's native decimals to 18 decimals for contract
 * 
 * @param tokenAmount - Amount in token's native decimals
 * @param token - Token symbol
 * @returns Amount normalized to 18 decimals
 */
export function normalizeAmountForContract(tokenAmount: bigint, token: string): bigint {
  const decimals = TOKEN_DECIMALS[token];
  if (decimals === undefined) {
    throw new Error(`Unknown token: ${token}`);
  }
  
  // Convert from token decimals to 18 decimals
  if (decimals === 18) {
    return tokenAmount;
  } else if (decimals < 18) {
    // Scale up from token decimals to 18
    const scaleFactor = BigInt(10 ** (18 - decimals));
    return tokenAmount * scaleFactor;
  } else {
    // This shouldn't happen with standard tokens
    throw new Error(`Unexpected decimal count ${decimals} for ${token}`);
  }
}