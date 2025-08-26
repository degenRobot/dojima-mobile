import { formatUnits, parseUnits } from 'viem';

// Token decimal constants
export const WETH_DECIMALS = 18;
export const USDC_DECIMALS = 6;
export const PRICE_DECIMALS = 18; // All prices stored in 18 decimals

/**
 * Format a price from contract format (18 decimals) to human readable
 */
export function formatPrice(price: bigint | string): string {
  const priceBigInt = typeof price === 'string' ? BigInt(price) : price;
  return formatUnits(priceBigInt, PRICE_DECIMALS);
}

/**
 * Format WETH amount from contract format to human readable
 */
export function formatWETH(amount: bigint | string): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
  return formatUnits(amountBigInt, WETH_DECIMALS);
}

/**
 * Format USDC amount from contract format to human readable
 */
export function formatUSDC(amount: bigint | string): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
  return formatUnits(amountBigInt, USDC_DECIMALS);
}

/**
 * Parse a human readable price to contract format (18 decimals)
 */
export function parsePrice(price: string): bigint {
  return parseUnits(price, PRICE_DECIMALS);
}

/**
 * Parse a human readable WETH amount to contract format
 */
export function parseWETH(amount: string): bigint {
  return parseUnits(amount, WETH_DECIMALS);
}

/**
 * Parse a human readable USDC amount to contract format
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/**
 * Calculate the USDC amount needed for a buy order
 * @param wethAmount Amount of WETH to buy (in 18 decimals)
 * @param price Price per WETH in USDC (in 18 decimals)
 * @returns USDC amount in 6 decimals
 */
export function calculateUSDCAmount(wethAmount: bigint, price: bigint): bigint {
  // price * amount / 10^18, then convert from 18 to 6 decimals
  const usdcAmount18 = (wethAmount * price) / BigInt(10 ** 18);
  return usdcAmount18 / BigInt(10 ** 12); // Convert 18 decimals to 6
}

/**
 * Calculate the USDC amount for display (human readable)
 * @param wethAmount Human readable WETH amount
 * @param price Human readable price
 * @returns Human readable USDC amount
 */
export function calculateUSDCTotal(wethAmount: string, price: string): string {
  const amount = parseFloat(wethAmount) || 0;
  const priceNum = parseFloat(price) || 0;
  return (amount * priceNum).toFixed(2);
}