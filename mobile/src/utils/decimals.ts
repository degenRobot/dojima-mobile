/**
 * Decimal handling utilities for UnifiedCLOB
 * 
 * IMPORTANT: The UnifiedCLOB contract expects prices to be in the quote token's decimals
 * This ensures proper calculation when: quoteAmount = (amount * price) / 10^18
 */

import { CONTRACTS, TRADING_BOOKS } from '../config/contracts';

// Token decimal mapping
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  WETH: 18,
  WBTC: 8,
};

/**
 * Convert a human-readable price to the correct format for the contract
 * @param humanPrice - The price in human-readable format (e.g., 2000 for 2000 USDC per WETH)
 * @param quoteToken - The quote token symbol (e.g., 'USDC')
 * @returns The price in the correct decimal format for the contract
 */
export function formatPrice(humanPrice: number, quoteToken: string): bigint {
  const decimals = TOKEN_DECIMALS[quoteToken];
  if (decimals === undefined) {
    throw new Error(`Unknown token: ${quoteToken}`);
  }
  
  // Convert to the quote token's decimals
  return BigInt(Math.floor(humanPrice * 10 ** decimals));
}

/**
 * Convert a human-readable amount to the correct format for the contract
 * @param humanAmount - The amount in human-readable format (e.g., 0.1 for 0.1 WETH)
 * @param token - The token symbol (e.g., 'WETH')
 * @returns The amount in the correct decimal format
 */
export function formatAmount(humanAmount: number, token: string): bigint {
  const decimals = TOKEN_DECIMALS[token];
  if (decimals === undefined) {
    throw new Error(`Unknown token: ${token}`);
  }
  
  return BigInt(Math.floor(humanAmount * 10 ** decimals));
}

/**
 * Convert a contract amount back to human-readable format
 * @param amount - The amount from the contract
 * @param token - The token symbol
 * @returns Human-readable amount
 */
export function parseAmount(amount: bigint, token: string): number {
  const decimals = TOKEN_DECIMALS[token];
  if (decimals === undefined) {
    throw new Error(`Unknown token: ${token}`);
  }
  
  return Number(amount) / (10 ** decimals);
}

/**
 * Convert a contract price back to human-readable format
 * @param price - The price from the contract
 * @param quoteToken - The quote token symbol
 * @returns Human-readable price
 */
export function parsePrice(price: bigint, quoteToken: string): number {
  const decimals = TOKEN_DECIMALS[quoteToken];
  if (decimals === undefined) {
    throw new Error(`Unknown token: ${quoteToken}`);
  }
  
  return Number(price) / (10 ** decimals);
}

/**
 * Helper to get book info and determine quote token
 * @param bookId - The book ID
 * @returns Book information including base and quote tokens
 */
export function getBookInfo(bookId: number) {
  const book = TRADING_BOOKS.find(b => b.id === bookId);
  if (!book) {
    throw new Error(`Invalid book ID: ${bookId}`);
  }
  return book;
}

/**
 * Format an order for the UnifiedCLOB contract
 * @param bookId - Trading book ID
 * @param isBuy - true for buy, false for sell
 * @param humanPrice - Human readable price
 * @param humanAmount - Human readable amount of base token
 * @returns Formatted order parameters
 */
export function formatOrder(
  bookId: number,
  isBuy: boolean,
  humanPrice: number,
  humanAmount: number
) {
  const book = getBookInfo(bookId);
  
  // Price is always in quote token decimals
  const price = formatPrice(humanPrice, book.quote);
  
  // Amount is always in base token decimals (what you're buying/selling)
  const amount = formatAmount(humanAmount, book.base);
  
  console.log(`📊 Formatting order for ${book.symbol}:`);
  console.log(`   Human: ${humanAmount} ${book.base} @ ${humanPrice} ${book.quote}`);
  console.log(`   Contract: amount=${amount} (${book.base} decimals), price=${price} (${book.quote} decimals)`);
  
  return { price, amount, book };
}

/**
 * Calculate the quote amount needed for a buy order
 * @param baseAmount - Amount of base token
 * @param price - Price in quote token decimals
 * @returns Quote amount needed
 */
export function calculateQuoteAmount(baseAmount: bigint, price: bigint): bigint {
  return (baseAmount * price) / BigInt(10 ** 18);
}

/**
 * Format a balance for display
 * @param amount - Balance amount from contract
 * @param token - Token symbol
 * @param digits - Number of decimal places to display
 * @returns Formatted balance string
 */
export function formatBalance(amount: bigint, token: string, digits: number = 4): string {
  const human = parseAmount(amount, token);
  
  if (human === 0) return '0';
  
  // For small amounts, show more precision
  if (human < 0.01) {
    return human.toExponential(2);
  }
  
  // For normal amounts, show specified digits
  return human.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/**
 * Validate that a price input is valid
 * @param price - Price to validate
 * @param quoteToken - Quote token symbol
 * @returns true if valid
 */
export function isValidPrice(price: number, quoteToken: string): boolean {
  if (price <= 0 || isNaN(price)) return false;
  
  const decimals = TOKEN_DECIMALS[quoteToken];
  if (decimals === undefined) return false;
  
  // Check if the price has too many decimal places
  const priceString = price.toString();
  const decimalIndex = priceString.indexOf('.');
  if (decimalIndex !== -1) {
    const decimalPlaces = priceString.length - decimalIndex - 1;
    if (decimalPlaces > decimals) return false;
  }
  
  return true;
}

/**
 * Validate that an amount input is valid
 * @param amount - Amount to validate
 * @param token - Token symbol
 * @returns true if valid
 */
export function isValidAmount(amount: number, token: string): boolean {
  if (amount <= 0 || isNaN(amount)) return false;
  
  const decimals = TOKEN_DECIMALS[token];
  if (decimals === undefined) return false;
  
  // Check if the amount has too many decimal places
  const amountString = amount.toString();
  const decimalIndex = amountString.indexOf('.');
  if (decimalIndex !== -1) {
    const decimalPlaces = amountString.length - decimalIndex - 1;
    if (decimalPlaces > decimals) return false;
  }
  
  return true;
}